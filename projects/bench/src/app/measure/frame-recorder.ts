import type { PhaseFrames } from './stats';

/*
 * The frame-time recorder (design 1.1): one rAF loop writing each frame's rAF timestamp, the
 * frame's begin time and not `performance.now()` inside the callback, into a typed array that is
 * allocated once. It is a raw-browser-API unit in the kit's sense (AGENTS.md): no Angular, no
 * signals, nothing written per frame but one array slot, so measuring costs the page next to
 * nothing and change detection never sees it. The rAF is injected so the specs run on a fake.
 *
 * A phase is the frames between two marks. The step machine starts a phase on the frame that ends
 * the one before and a long frame stretches a phase instead of skipping the next, so a phase's
 * time is the span between its marks, not its planned length. `between` hands over the deltas and
 * that span together as `PhaseFrames`: whoever computes a phase's statistics (the page's driver,
 * Task 4) must pass `windowMs` from there to `frameStats`, never the phase's planned `ms`, or a
 * stretched phase reports a better fps than the page showed.
 */

/** rAF as the recorder uses it; the page's is `windowFrames()`, the specs' a fake. */
export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface FrameRecorderOptions {
  readonly scheduler?: FrameScheduler;
  /** Frames the buffer holds: a step's frames, not a run's (`reset` between steps). */
  readonly capacity?: number;
  /**
   * Called on every frame after it is recorded, with its timestamp: where the page ticks the step
   * machine and takes marks. One function for the whole run, so it allocates nothing either.
   */
  readonly onFrame?: (timeMs: number) => void;
}

/**
 * About seven minutes at 144 Hz: a step is some 13 s planned, and the step machine aborts one at
 * three times that, so a step cannot fill it unless something else is wrong. (A run sizes its own
 * buffer for 240 Hz: `frameCapacity`.)
 */
const DEFAULT_CAPACITY = 65536;

/** The refresh rates displays commonly run at, to snap a measured interval to. */
const COMMON_HZ: readonly number[] = [30, 50, 60, 75, 90, 120, 144, 240];
/** Two seconds of an empty page give at least 60 frames; fewer means rAF was throttled. */
const MIN_CALIBRATION_FRAMES = 20;

/** The page's rAF; throws where there is no window, so a missing one is not silent. */
export function windowFrames(): FrameScheduler {
  return {
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (handle) => window.cancelAnimationFrame(handle),
  };
}

export class FrameRecorder {
  private readonly scheduler: FrameScheduler;
  private readonly times: Float64Array;
  private readonly onFrame?: (timeMs: number) => void;
  private count = 0;
  private full = false;
  private handle = 0;
  private active = false;

  /** The one callback every frame is requested with; made here so no frame makes a closure. */
  private readonly frame: FrameRequestCallback = (timeMs) => {
    if (!this.active) return;
    this.handle = this.scheduler.request(this.frame);
    if (this.count < this.times.length) this.times[this.count++] = timeMs;
    else this.full = true;
    this.onFrame?.(timeMs);
  };

  constructor(options: FrameRecorderOptions = {}) {
    const capacity = options.capacity ?? DEFAULT_CAPACITY;
    if (!Number.isInteger(capacity) || capacity < 2) {
      throw new RangeError(`a phase needs two frames, so a capacity of ${capacity} holds none`);
    }
    this.scheduler = options.scheduler ?? windowFrames();
    this.onFrame = options.onFrame;
    this.times = new Float64Array(capacity);
  }

  /** The timestamps' buffer, the same one for the recorder's whole life. */
  get buffer(): Float64Array {
    return this.times;
  }

  /** Frames recorded since the last start or reset. */
  get frames(): number {
    return this.count;
  }

  get running(): boolean {
    return this.active;
  }

  /** Whether frames came after the buffer was full: they went uncounted, so phases are refused. */
  get overflowed(): boolean {
    return this.full;
  }

  /** Begins a fresh recording. */
  start(): void {
    if (this.active) throw new Error('the recorder is already running');
    this.reset();
    this.active = true;
    this.handle = this.scheduler.request(this.frame);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.scheduler.cancel(this.handle);
  }

  /** Forgets the frames, keeps running: a new step's phases start from nothing. */
  reset(): void {
    this.count = 0;
    this.full = false;
  }

  /** The latest frame, as the anchor a phase starts or ends on (call it from `onFrame`). */
  mark(): number {
    if (this.count === 0) throw new Error('a phase starts on a frame, and none has come yet');
    return this.count - 1;
  }

  /**
   * The frames after mark `from` up to and including mark `to`, as deltas, with the real span
   * between the two frames as the window. Copies, so the next phase cannot change them.
   */
  between(from: number, to: number): PhaseFrames {
    if (this.full) {
      throw new RangeError(`more than ${this.times.length} frames: the phase is not whole`);
    }
    if (!(from >= 0 && from < to && to < this.count)) {
      throw new RangeError(
        `marks ${from} and ${to} do not bound a phase among ${this.count} recorded frames`,
      );
    }
    const deltas = new Float64Array(to - from);
    for (let i = from + 1; i <= to; i++) deltas[i - from - 1] = this.times[i] - this.times[i - 1];
    return { deltas, windowMs: this.times[to] - this.times[from] };
  }
}

/** The display's refresh as a run keeps it: snapped for judging, measured for the record. */
export interface Refresh {
  readonly hz: number;
  /** The interval every judgment uses: 1000 ÷ `hz`. */
  readonly intervalMs: number;
  /** The median frame delta the snap came from. */
  readonly measuredMs: number;
}

/**
 * The refresh interval from a calibration phase (design 1.1: two seconds of an empty page): the
 * median delta, snapped to the nearest common rate in Hz. The median shrugs off the hitches of
 * a page that is still settling; the snap turns 59.94 Hz into 60. Nothing here assumes 60: the
 * board on 4K HDMI 1.4 runs at 30 Hz and laptops at 120.
 */
export function calibrateRefresh(calibration: PhaseFrames): Refresh {
  const { deltas } = calibration;
  if (deltas.length < MIN_CALIBRATION_FRAMES) {
    throw new RangeError(
      `${deltas.length} frames cannot calibrate the refresh (need ${MIN_CALIBRATION_FRAMES}): ` +
        'a hidden tab or a stalled page',
    );
  }
  const sorted = Float64Array.from(deltas).sort();
  const upper = sorted.length >> 1;
  const measuredMs =
    sorted.length % 2 === 0 ? (sorted[upper - 1] + sorted[upper]) / 2 : sorted[upper];
  const measuredHz = 1000 / measuredMs;
  let hz = COMMON_HZ[0];
  for (const candidate of COMMON_HZ) {
    if (Math.abs(candidate - measuredHz) < Math.abs(hz - measuredHz)) hz = candidate;
  }
  return { hz, intervalMs: 1000 / hz, measuredMs };
}
