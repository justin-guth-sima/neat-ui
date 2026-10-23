import type { NeatMetadataSnapshot } from './metadata-sync';

const LATE_SHARE_ON = 0.5;
const LATE_SHARE_OFF = 0.1;
const BUFFER_MARGIN_MS = 50;
const BUFFER_STEP_MS = 50;
// Matches the upper bound of the video sync buffer setting.
const BUFFER_MAX_MS = 4000;
const SETTLE_MS_PER_RAISED_MS = 10;
const SETTLE_BASE_MS = 1000;

/** The part of a queue snapshot that the late notice reads. */
export type NeatLatenessSnapshot = Pick<
  NeatMetadataSnapshot,
  'recentLateShare' | 'recentLatenessMedianMs' | 'recentLatenessP90Ms'
>;

/**
 * Why no buffer is suggested: the browser cannot set one, the window has no lateness sample, or
 * the suggestion would pass the maximum.
 */
export type NeatLateNoticeBlocker = 'unsupported' | 'unmeasured' | 'maximum';

/**
 * The notice's second button: `raise` lifts the value the channels follow to the suggestion;
 * `follow` only lets this channel adopt the followed value, which already covers it.
 */
export interface NeatGlobalBufferAction {
  kind: 'raise' | 'follow';
  valueMs: number;
}

export interface NeatLateNoticeDetails {
  latenessMs: number | null;
  latePercent: number | null;
  bufferMs: number;
  suggestedBufferMs: number | null;
  blockedBy: NeatLateNoticeBlocker | null;
  globalAction: NeatGlobalBufferAction | null;
}

// Two thresholds, so a share hovering around one value does not make the chip blink.
export function nextWarningActive(active: boolean, recentLateShare: number | null): boolean {
  if (recentLateShare == null) return active;
  if (recentLateShare >= LATE_SHARE_ON) return true;
  if (recentLateShare < LATE_SHARE_OFF) return false;
  return active;
}

export function suggestedBufferMs(
  currentBufferMs: number,
  p90LatenessMs: number | null,
): number | null {
  if (p90LatenessMs === null) return null;
  if (!Number.isFinite(currentBufferMs) || !Number.isFinite(p90LatenessMs)) return null;
  const needed = currentBufferMs + p90LatenessMs + BUFFER_MARGIN_MS;
  const suggested = Math.ceil(needed / BUFFER_STEP_MS) * BUFFER_STEP_MS;
  return suggested > BUFFER_MAX_MS ? null : suggested;
}

// A browser moves to a raised jitter buffer target gradually, roughly 100 ms per
// second of video. What is measured until it has arrived describes the old buffer.
export function bufferSettleMs(previousBufferMs: number, nextBufferMs: number): number {
  const raisedBy = Math.max(0, nextBufferMs - previousBufferMs);
  if (!Number.isFinite(raisedBy)) return SETTLE_BASE_MS;
  return raisedBy * SETTLE_MS_PER_RAISED_MS + SETTLE_BASE_MS;
}

// The global value is never lowered. Without a known followed value the button offers the raise.
function globalActionFor(
  suggested: number | null,
  followedBufferMs: number | null | undefined,
): NeatGlobalBufferAction | null {
  if (suggested === null) return null;
  if (
    typeof followedBufferMs === 'number' &&
    Number.isFinite(followedBufferMs) &&
    followedBufferMs >= suggested
  ) {
    return { kind: 'follow', valueMs: followedBufferMs };
  }
  return { kind: 'raise', valueMs: suggested };
}

export function lateNoticeDetails(
  snapshot: NeatLatenessSnapshot,
  currentBufferMs: number,
  bufferSupported: boolean,
  followedBufferMs?: number | null,
): NeatLateNoticeDetails {
  const suggested = bufferSupported
    ? suggestedBufferMs(currentBufferMs, snapshot.recentLatenessP90Ms)
    : null;
  let blockedBy: NeatLateNoticeBlocker | null = null;
  if (!bufferSupported) blockedBy = 'unsupported';
  else if (!Number.isFinite(snapshot.recentLatenessP90Ms)) blockedBy = 'unmeasured';
  else if (suggested === null) blockedBy = 'maximum';
  return {
    latenessMs:
      snapshot.recentLatenessMedianMs == null ? null : Math.round(snapshot.recentLatenessMedianMs),
    latePercent:
      snapshot.recentLateShare == null ? null : Math.round(snapshot.recentLateShare * 100),
    bufferMs: currentBufferMs,
    suggestedBufferMs: suggested,
    blockedBy,
    globalAction: globalActionFor(suggested, followedBufferMs),
  };
}
