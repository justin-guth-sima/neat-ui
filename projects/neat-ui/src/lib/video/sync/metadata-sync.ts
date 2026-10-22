import type { NeatMetadataMessage } from './metadata-message';

/** Capacity of each store, counted in messages. The oldest are evicted first. */
const METADATA_QUEUE_LIMIT = 300;
const LATENESS_WINDOW_MS = 5000;
const LATENESS_WINDOW_MIN_MESSAGES = 10;
// Bounds both memories against a stream that presents or sends far faster than expected.
const LATENESS_MEMORY_LIMIT = 1024;

const AUXILIARY_METADATA_TYPE = 'auxiliary-visualization';
const AUXILIARY_MAX_ID_LENGTH = 128;

/** A message with the time it arrived, as the queue stores and returns it. */
export interface NeatMetadataItem {
  receivedAt: number;
  data: NeatMetadataMessage;
}

/** An item as returned for drawing; `held` marks one redrawn from an earlier frame. */
export type NeatDrawableMetadataItem = NeatMetadataItem & { held?: true };

/** The last item of each metadata type, kept by `holdOverlays` between frames. */
export type NeatHeldOverlays = Map<string, { item: NeatMetadataItem; matchedAt: number }>;

/** Cumulative counters; they survive `resetLatenessWindow`. */
export interface NeatMetadataQueueStats {
  timestampMatches: number;
  arrivalFallbacks: number;
  frameMisses: number;
  expired: number;
  evicted: number;
  untimestampedReceived: number;
  late: number;
}

export interface NeatMetadataSnapshot extends NeatMetadataQueueStats {
  timestampedPending: number;
  arrivalPending: number;
  /** Null until the window holds enough messages for a share to mean anything. */
  recentLateShare: number | null;
  /** Null while the window holds no late message whose frame is still remembered. */
  recentLatenessMedianMs: number | null;
  recentLatenessP90Ms: number | null;
  recentLatenessMaxMs: number | null;
}

interface LatenessOutcome {
  at: number;
  late: boolean;
  latenessMs: number | null;
}

/**
 * The per-stream queue. Create it with `createMetadataQueue` and pass it to this module's
 * functions; `metadataQueueSnapshot` reports what it holds. Its contents are not accessible.
 */
export interface NeatMetadataQueue {
  readonly __neatMetadataQueue: never;
}

/** The only place the opaque handle is opened. */
function stateOf(queue: NeatMetadataQueue): MetadataQueueState {
  return queue as unknown as MetadataQueueState;
}

/** What a `NeatMetadataQueue` holds. Internal: callers see the queue only through its functions. */
interface MetadataQueueState {
  /** RTP timestamp -> one item per metadata type, in arrival order. */
  timestamped: Map<number, Map<string, NeatMetadataItem>>;
  timestampedEntries: number;
  arrival: NeatMetadataItem[];
  /** Presented frames, oldest first: RTP timestamp -> presentation time. */
  presented: Map<number, number>;
  lastPresented: number | null;
  lastPresentedAt: number;
  /** Outcomes of timestamped messages in the recent window, oldest first. */
  outcomes: LatenessOutcome[];
  stats: NeatMetadataQueueStats;
}

/**
 * What distinguishes two messages of one frame. Auxiliary views share a type, so each id is its
 * own key; the type alone would let one view replace another.
 */
function metadataTypeOf(message: NeatMetadataMessage): string {
  if (message.type !== AUXILIARY_METADATA_TYPE) return message.type;
  const data = message.data as { id?: unknown } | null | undefined;
  const id = typeof data?.id === 'string' ? data.id.trim() : '';
  return id && id.length <= AUXILIARY_MAX_ID_LENGTH
    ? `${AUXILIARY_METADATA_TYPE}\u0000${id}`
    : AUXILIARY_METADATA_TYPE;
}

export function createMetadataQueue(): NeatMetadataQueue {
  const state: MetadataQueueState = {
    timestamped: new Map(),
    timestampedEntries: 0,
    arrival: [],
    presented: new Map(),
    lastPresented: null,
    lastPresentedAt: 0,
    outcomes: [],
    stats: {
      timestampMatches: 0,
      arrivalFallbacks: 0,
      frameMisses: 0,
      expired: 0,
      evicted: 0,
      untimestampedReceived: 0,
      late: 0,
    },
  };
  return state as unknown as NeatMetadataQueue;
}

export function enqueueMetadata(
  handle: NeatMetadataQueue,
  message: NeatMetadataMessage,
  receivedAt: number,
): void {
  const queue = stateOf(handle);
  // The message comes off the wire, so the timestamp is checked at run time whatever its type says.
  const key = message._insight?.rtp_timestamp;
  const item: NeatMetadataItem = { receivedAt, data: message };
  // Only a valid unsigned 32-bit RTP timestamp keys a frame; larger values would
  // alias another frame's entry and replace it.
  if (key !== undefined && Number.isInteger(key) && key >= 0 && key <= 0xffffffff) {
    if (isLate(queue, key)) {
      // Its frame is gone, so it can never be drawn. Queueing it would only
      // surface later as an eviction, which reads as a capacity problem.
      const presentedAt = queue.presented.get(key);
      queue.stats.late += 1;
      recordOutcome(queue, {
        at: queue.lastPresentedAt,
        late: true,
        latenessMs: presentedAt === undefined ? null : Math.max(0, receivedAt - presentedAt),
      });
      return;
    }
    // A producer may describe one frame with several metadata types, so a frame
    // holds one entry per type. A repeat of the same type replaces it.
    const byType = queue.timestamped.get(key) ?? new Map<string, NeatMetadataItem>();
    const type = metadataTypeOf(message);
    if (!byType.has(type)) queue.timestampedEntries += 1;
    queue.timestamped.delete(key);
    byType.delete(type);
    byType.set(type, item);
    queue.timestamped.set(key, byType);
    while (queue.timestampedEntries > METADATA_QUEUE_LIMIT) {
      // The loop only runs while entries exist, so the map is not empty.
      const [oldest, evictedTypes] = queue.timestamped.entries().next().value as [
        number,
        Map<string, NeatMetadataItem>,
      ];
      queue.timestampedEntries -= evictedTypes.size;
      queue.stats.evicted += evictedTypes.size;
      queue.timestamped.delete(oldest);
    }
    return;
  }

  queue.stats.untimestampedReceived += 1;
  queue.arrival.push(item);
  if (queue.arrival.length > METADATA_QUEUE_LIMIT) {
    const evicted = queue.arrival.length - METADATA_QUEUE_LIMIT;
    queue.arrival.splice(0, evicted);
    queue.stats.evicted += evicted;
  }
}

/**
 * The metadata to draw on a frame the browser is presenting. `rtpTimestamp` is the frame's RTP
 * timestamp, or null when the browser does not report one. A retention of 0 never expires.
 */
export function takeMetadataForFrame(
  handle: NeatMetadataQueue,
  rtpTimestamp: number | null,
  metadataRetentionMs: number,
  now: number,
): NeatMetadataItem[] {
  const queue = stateOf(handle);
  pruneMetadataQueue(queue, metadataRetentionMs, now);
  const hasFrameTimestamp =
    rtpTimestamp !== null && Number.isInteger(rtpTimestamp) && rtpTimestamp >= 0;
  if (hasFrameTimestamp) {
    const key = rtpTimestamp >>> 0;
    recordPresentedFrame(queue, key, now);
    const byType = queue.timestamped.get(key) ?? null;
    if (byType && byType.size > 0) {
      queue.timestamped.delete(key);
      queue.timestampedEntries -= byType.size;
      queue.stats.timestampMatches += 1;
      // The late share is a share of messages, so every type of the frame counts.
      for (let matched = 0; matched < byType.size; matched += 1) {
        recordOutcome(queue, { at: now, late: false, latenessMs: null });
      }
      return [...byType.values()];
    }
  }

  if (!hasFrameTimestamp) {
    let latest: NeatMetadataItem | null = null;
    let latestFrame: Map<string, NeatMetadataItem> | null = null;
    // Arrival time selects a frame; only its shared timestamp can group types.
    for (const byType of queue.timestamped.values()) {
      for (const item of byType.values()) {
        if (!latest || item.receivedAt >= latest.receivedAt) {
          latest = item;
          latestFrame = byType;
        }
      }
    }
    for (const item of queue.arrival) {
      if (!latest || item.receivedAt >= latest.receivedAt) {
        latest = item;
        latestFrame = null;
      }
    }
    queue.timestamped.clear();
    queue.timestampedEntries = 0;
    queue.arrival.length = 0;
    if (latest) {
      queue.stats.arrivalFallbacks += 1;
      return latestFrame ? [...latestFrame.values()] : [latest];
    }
  }

  if (queue.arrival.length > 0) {
    const latest = queue.arrival[queue.arrival.length - 1];
    queue.arrival.length = 0;
    queue.stats.arrivalFallbacks += 1;
    return [latest];
  }
  queue.stats.frameMisses += 1;
  return [];
}

// Inference often runs slower than the video, so many frames carry no message of a
// type. Such a frame redraws that type's last message for up to OVERLAY_HOLD_MS instead
// of flickering it off. A message that arrives, even one with no objects, replaces it.
export const OVERLAY_HOLD_MS = 200;

export function holdOverlays(
  held: NeatHeldOverlays,
  overlays: NeatMetadataItem[],
  now: number,
): NeatDrawableMetadataItem[] {
  const fresh = new Set<string>();
  for (const item of overlays) {
    const type = metadataTypeOf(item.data);
    fresh.add(type);
    held.set(type, { item, matchedAt: now });
  }
  const repeats: NeatDrawableMetadataItem[] = [];
  for (const [type, { item, matchedAt }] of held) {
    if (fresh.has(type)) continue;
    if (now - matchedAt > OVERLAY_HOLD_MS) held.delete(type);
    else repeats.push({ ...item, held: true });
  }
  return [...overlays, ...repeats];
}

export function metadataQueueSnapshot(handle: NeatMetadataQueue): NeatMetadataSnapshot {
  const queue = stateOf(handle);
  const lateOutcomes = queue.outcomes.filter((outcome) => outcome.late);
  const lateness = lateOutcomes
    .map((outcome) => outcome.latenessMs)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  return {
    ...queue.stats,
    timestampedPending: queue.timestampedEntries,
    arrivalPending: queue.arrival.length,
    recentLateShare:
      queue.outcomes.length >= LATENESS_WINDOW_MIN_MESSAGES
        ? lateOutcomes.length / queue.outcomes.length
        : null,
    recentLatenessMedianMs: nearestRank(lateness, 0.5),
    recentLatenessP90Ms: nearestRank(lateness, 0.9),
    recentLatenessMaxMs: lateness.length ? lateness[lateness.length - 1] : null,
  };
}

export function resetLatenessWindow(handle: NeatMetadataQueue): void {
  stateOf(handle).outcomes.length = 0;
}

// The subtraction is reduced to a signed 32-bit value, so it stays correct
// across the RTP timestamp wrap.
function isLate(queue: MetadataQueueState, key: number): boolean {
  return queue.lastPresented !== null && ((key - queue.lastPresented) | 0) <= 0;
}

// The window is aged here and nowhere else: a hidden tab presents no frames
// while messages keep arriving, and must not dilute or expire the window.
function recordPresentedFrame(queue: MetadataQueueState, key: number, now: number): void {
  queue.presented.delete(key);
  queue.presented.set(key, now);
  queue.lastPresented = key;
  queue.lastPresentedAt = now;
  for (const [timestamp, presentedAt] of queue.presented) {
    if (now - presentedAt <= LATENESS_WINDOW_MS && queue.presented.size <= LATENESS_MEMORY_LIMIT) {
      break;
    }
    queue.presented.delete(timestamp);
  }
  let expired = 0;
  while (expired < queue.outcomes.length && now - queue.outcomes[expired].at > LATENESS_WINDOW_MS) {
    expired += 1;
  }
  if (expired > 0) queue.outcomes.splice(0, expired);
}

function recordOutcome(queue: MetadataQueueState, outcome: LatenessOutcome): void {
  queue.outcomes.push(outcome);
  if (queue.outcomes.length > LATENESS_MEMORY_LIMIT) {
    queue.outcomes.splice(0, queue.outcomes.length - LATENESS_MEMORY_LIMIT);
  }
}

function nearestRank(sorted: number[], fraction: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

function pruneMetadataQueue(
  queue: MetadataQueueState,
  metadataRetentionMs: number,
  now: number,
): void {
  if (metadataRetentionMs <= 0) return;
  // Types for one frame arrive at different times, and a frame moves to the
  // end of the map on each arrival, so neither frames nor entries sit in age
  // order. Every entry is checked; a frame goes only once it holds none.
  for (const [timestamp, byType] of queue.timestamped) {
    for (const [type, item] of byType) {
      if (now - item.receivedAt <= metadataRetentionMs) continue;
      byType.delete(type);
      queue.timestampedEntries -= 1;
      queue.stats.expired += 1;
    }
    if (byType.size === 0) queue.timestamped.delete(timestamp);
  }
  while (queue.arrival.length && now - queue.arrival[0].receivedAt > metadataRetentionMs) {
    queue.arrival.shift();
    queue.stats.expired += 1;
  }
}
