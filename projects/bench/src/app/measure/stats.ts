/*
 * What a phase's frame times say: the headline numbers of a run (design 1.1) and the verdicts the
 * ladders stop and refine on. Pure functions over the frame deltas the recorder hands over at a
 * phase's end, never called per frame, so a copy for sorting costs nothing that is measured. Every
 * judgement is against the refresh interval the run measured, never an assumed 60 Hz: the board on
 * 4K HDMI 1.4 runs at 30 Hz, and laptops may run at 120 Hz.
 */

/** A phase's frame statistics, as a run's result keeps them; times in ms. */
export interface FrameStats {
  readonly frames: number;
  /** Frames per second over the phase's window. */
  readonly fps: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly worst: number;
  /** Refreshes that showed no new frame: Σ max(0, round(delta ÷ interval) − 1). */
  readonly dropped: number;
  /** `dropped` as a share of the refreshes the phase's frames spanned. */
  readonly droppedPct: number;
  /** Frames over twice the interval: a hitch anyone sees. */
  readonly janks: number;
  /** Frames of 50 ms or more: the page did not respond for a moment. */
  readonly stalls: number;
}

/**
 * The verdicts (decided two-tier, design open question 1): `smooth` is p95 within 1.25 intervals
 * and at most 5 % dropped; `usable` is 30 fps or more with p99 within 100 ms; anything else fails.
 */
export type Tier = 'smooth' | 'usable' | 'failing';

/** What a step's phases add up to: what the stop rule and the refinement decide on. */
export interface StepOutcome {
  /** All the step's frames over all its phases' windows. */
  readonly meanFps: number;
  /** The median of all the step's frames. */
  readonly p50Ms: number;
  /** Its worst phase's tier, so a smooth idle phase cannot hide a rough pan. */
  readonly tier: Tier;
}

/**
 * A phase's frame deltas and the window they were measured over. The window is the real span
 * between the phase's first and last frame, never its planned `ms`: a phase ends on the first frame
 * past its time, so a long frame stretches it. `FrameRecorder.between` hands both over together,
 * and the page's driver (Task 4) must pass them on as they are.
 */
export interface PhaseFrames {
  readonly deltas: ArrayLike<number>;
  readonly windowMs: number;
}

const STALL_MS = 50;
const SMOOTH_P95_INTERVALS = 1.25;
const SMOOTH_DROPPED_PCT = 5;
const USABLE_FPS = 30;
const USABLE_P99_MS = 100;
const TIER_ORDER: readonly Tier[] = ['smooth', 'usable', 'failing'];

/** The nearest-rank `p`th percentile of ascending `sorted` (not empty): a value it holds. */
export function percentile(sorted: ArrayLike<number>, p: number): number {
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/** The statistics of a phase's frame `deltas` over `windowMs`, judged against `intervalMs`. */
export function frameStats(
  deltas: ArrayLike<number>,
  windowMs: number,
  intervalMs: number,
): FrameStats {
  // The step machine starts each phase on a frame and ends it on a later one, so a phase always
  // has a frame; none means the recorder and the machine disagree, which must not pass quietly.
  if (deltas.length === 0) throw new RangeError('a phase without a frame has no statistics');
  if (!(windowMs > 0)) throw new RangeError(`a phase's window must be positive, not ${windowMs}`);
  if (!(intervalMs > 0))
    throw new RangeError(`the refresh interval must be positive, not ${intervalMs}`);

  const sorted = Float64Array.from(deltas).sort();
  let dropped = 0;
  let janks = 0;
  let stalls = 0;
  for (const delta of sorted) {
    dropped += Math.max(0, Math.round(delta / intervalMs) - 1);
    if (delta > 2 * intervalMs) janks++;
    if (delta >= STALL_MS) stalls++;
  }
  return {
    frames: sorted.length,
    fps: (sorted.length * 1000) / windowMs,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    worst: sorted[sorted.length - 1],
    dropped,
    droppedPct: (dropped / (sorted.length + dropped)) * 100,
    janks,
    stalls,
  };
}

/** The tier a phase's statistics reach. */
export function tierOf(stats: FrameStats, intervalMs: number): Tier {
  if (stats.p95 <= SMOOTH_P95_INTERVALS * intervalMs && stats.droppedPct <= SMOOTH_DROPPED_PCT) {
    return 'smooth';
  }
  return stats.fps >= USABLE_FPS && stats.p99 <= USABLE_P99_MS ? 'usable' : 'failing';
}

/**
 * A phase's statistics as a user saw them, where the display's own count of what it presented
 * (`presentedFps`, from a trace) is below the recorder's rate: the page produced those frames and
 * the display never drew them, so they were not seen. The rate is the presented one, and the
 * dropped share is at least the refreshes that showed nothing new, `1 - presented / refresh rate`
 * (what `dropped` counts from the frame times). Anything else about the frames stays the
 * recorder's: a trace gives a count, not their spacing. A phase with no presented rate, or one
 * the recorder agrees with or is below, is returned as it is.
 */
export function withPresented(
  stats: FrameStats,
  presentedFps: number | undefined,
  intervalMs: number,
): FrameStats {
  if (presentedFps === undefined || !(presentedFps < stats.fps)) return stats;
  const shortfallPct = (1 - (presentedFps * intervalMs) / 1000) * 100;
  return {
    ...stats,
    fps: presentedFps,
    droppedPct: Math.max(stats.droppedPct, shortfallPct),
  };
}

/** What a step's `phases` add up to, judged against `intervalMs`. */
export function stepOutcome(phases: readonly PhaseFrames[], intervalMs: number): StepOutcome {
  if (phases.length === 0) throw new RangeError('a step without a phase has no outcome');
  let worst = 0;
  let frames = 0;
  let windowMs = 0;
  for (const phase of phases) {
    const tier = tierOf(frameStats(phase.deltas, phase.windowMs, intervalMs), intervalMs);
    worst = Math.max(worst, TIER_ORDER.indexOf(tier));
    frames += phase.deltas.length;
    windowMs += phase.windowMs;
  }
  const pooled = new Float64Array(frames);
  let offset = 0;
  for (const phase of phases) {
    pooled.set(phase.deltas, offset);
    offset += phase.deltas.length;
  }
  return {
    meanFps: (frames * 1000) / windowMs,
    p50Ms: percentile(pooled.sort(), 50),
    tier: TIER_ORDER[worst],
  };
}
