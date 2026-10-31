/*
 * Messages and bytes per edge, for the rate cards and the notes an app fills: a rate over the last
 * second and a history of messages per second. Pure (no Angular, no clock of its own): the caller
 * gives every time, on the same clock it gives `count`. Ported from the Autoware demo's
 * `LinkRates`, its window kept.
 */

/** The sliding window a rate is taken over. */
export const RATE_WINDOW_MS = 1000;

/** How many whole seconds a history holds. */
export const HISTORY_SECONDS = 60;

/**
 * How many seconds the history buckets cover, past and future. A message can be counted before its
 * second (a step dot is counted when it is placed, up to a chain's travel ahead), so the buckets
 * reach well past the shown minute; a message more than this far ahead would take the bucket of
 * an old second, which only a chain far beyond the demo's (minutes of travel) can do.
 */
const BUCKETS = 256;

/**
 * How many messages a new edge's ring holds at first. The ring doubles when it is full and the
 * message it would overwrite could still be in a rate window, up to the capacity: a rare or idle
 * id costs a few kB (mostly its history buckets), and a steady edge stays at the size of its
 * window, not a full ring.
 */
const FIRST_RING = 32;

/** An edge's rate over the last second. */
export interface EdgeRate {
  msgsPerSec: number;
  bytesPerSec: number;
}

const NO_HISTORY: readonly number[] = Object.freeze([]);

/** What is kept of one edge. */
interface Track {
  /** The ring of its latest messages: when each starts and its bytes (as long as each other). */
  at: Float64Array;
  bytes: Float64Array;
  next: number;
  size: number;
  /** Messages per second, by second modulo `BUCKETS`, and which second each bucket holds. */
  counts: Float64Array;
  seconds: Float64Array;
  /** The earliest second counted, where the history starts. */
  first: number;
  /** The last history given and its last second, NaN when a count has changed it since. */
  history: readonly number[];
  historyTo: number;
}

/**
 * Per edge, a ring of the latest `capacity` messages, so a rate is exact at any moment (a step
 * dot counted ahead of its start is not in a rate until then), and per-second buckets for the
 * history, so a busy edge's minute does not need a ring of every message in it.
 *
 * The ring limits what a rate counts: an edge counts short once more than `capacity` messages are
 * newer than the window's start. Step dots are counted when they are placed, up to six steps of
 * travel ahead (24 s at 4 s travel), so a step at 72 msg/s holds 72 · 25 ≈ 1800; 4096 keeps
 * every edge of the demo exact. The ring only grows that far while its messages are still ahead
 * of, or inside, the window (see `count`): a steady edge keeps about a window's worth.
 *
 * A message whose time is not a finite number is not counted: no window or second holds it.
 *
 * Any id counts, an edge on no level drawn as much as one on screen: the rates are the app's
 * numbers, and a card on another level should read right the moment it opens.
 */
export class EdgeRates {
  private readonly tracks = new Map<string, Track>();

  constructor(private readonly capacity = 4096) {}

  /**
   * A message of `bytes` on `edge` that starts at `atMs`, counted at `nowMs` (the clock's time
   * now, which is `atMs` unless the message starts ahead, as a step dot does). A full ring grows
   * only while the message it would overwrite is newer than the window that ends at `nowMs`: an
   * older one is out of every rate to come, as `nowMs` only goes forward.
   */
  count(edge: string, bytes: number, atMs: number, nowMs: number = atMs): void {
    if (!Number.isFinite(atMs)) return;
    const track = this.tracks.get(edge) ?? this.track(edge);
    if (
      track.size === track.at.length &&
      track.size < this.capacity &&
      track.at[track.next] > nowMs - RATE_WINDOW_MS
    ) {
      grow(track, this.capacity);
    }
    track.at[track.next] = atMs;
    track.bytes[track.next] = bytes;
    track.next = (track.next + 1) % track.at.length;
    track.size = Math.min(track.size + 1, track.at.length);

    const second = Math.floor(atMs / 1000);
    const bucket = bucketOf(second);
    // A bucket holding a later second keeps it: this message is too old for any history shown.
    if (track.seconds[bucket] > second) return;
    if (track.seconds[bucket] !== second) {
      track.seconds[bucket] = second;
      track.counts[bucket] = 0;
    }
    track.counts[bucket]++;
    if (second < track.first) track.first = second;
    if (second <= track.historyTo) track.historyTo = NaN;
  }

  /**
   * `edge`'s messages and bytes per second in the window that ends at `nowMs`, written into
   * `into` (so a caller that reads every frame allocates nothing). An edge never counted has none.
   */
  snapshot(
    edge: string,
    nowMs: number,
    into: EdgeRate = { msgsPerSec: 0, bytesPerSec: 0 },
  ): EdgeRate {
    let msgs = 0;
    let bytes = 0;
    const track = this.tracks.get(edge);
    if (track) {
      const from = nowMs - RATE_WINDOW_MS;
      for (let i = 0; i < track.size; i++) {
        const at = track.at[i];
        if (at > from && at <= nowMs) {
          msgs++;
          bytes += track.bytes[i];
        }
      }
    }
    const perSecond = 1000 / RATE_WINDOW_MS;
    into.msgsPerSec = msgs * perSecond;
    into.bytesPerSec = bytes * perSecond;
    return into;
  }

  /**
   * `edge`'s messages in each whole second before `nowMs`'s, oldest first: from the first second
   * counted, at most the last `HISTORY_SECONDS`. The second under way is left out, so the newest
   * value does not dip and climb as it fills. The same array comes back until a second passes or a
   * count changes it, so a sparkline fed at the numbers' refresh rate redraws once a second.
   */
  history(edge: string, nowMs: number): readonly number[] {
    const track = this.tracks.get(edge);
    if (!track) return NO_HISTORY;
    const last = Math.floor(nowMs / 1000) - 1;
    if (last === track.historyTo) return track.history;
    const values: number[] = [];
    for (let s = Math.max(track.first, last - HISTORY_SECONDS + 1); s <= last; s++) {
      const bucket = bucketOf(s);
      values.push(track.seconds[bucket] === s ? track.counts[bucket] : 0);
    }
    track.history = values;
    track.historyTo = last;
    return values;
  }

  /** How many messages `edge`'s ring holds now (0 for an edge never counted): for the specs. */
  ringLength(edge: string): number {
    return this.tracks.get(edge)?.at.length ?? 0;
  }

  clear(): void {
    this.tracks.clear();
  }

  private track(edge: string): Track {
    const track: Track = {
      at: new Float64Array(Math.min(FIRST_RING, this.capacity)),
      bytes: new Float64Array(Math.min(FIRST_RING, this.capacity)),
      next: 0,
      size: 0,
      counts: new Float64Array(BUCKETS),
      seconds: new Float64Array(BUCKETS).fill(NaN),
      first: Infinity,
      history: NO_HISTORY,
      historyTo: NaN,
    };
    this.tracks.set(edge, track);
    return track;
  }
}

/**
 * A full ring doubled, at most to `capacity`. It may have wrapped before, so its messages are
 * copied oldest first (from `next`, where the oldest is) and the next goes after them.
 */
function grow(track: Track, capacity: number): void {
  const length = Math.min(2 * track.at.length, capacity);
  const at = new Float64Array(length);
  const bytes = new Float64Array(length);
  const { next } = track;
  at.set(track.at.subarray(next));
  at.set(track.at.subarray(0, next), track.at.length - next);
  bytes.set(track.bytes.subarray(next));
  bytes.set(track.bytes.subarray(0, next), track.bytes.length - next);
  track.next = track.at.length;
  track.at = at;
  track.bytes = bytes;
}

/** The bucket of a second, negative seconds included. */
function bucketOf(second: number): number {
  return ((second % BUCKETS) + BUCKETS) % BUCKETS;
}
