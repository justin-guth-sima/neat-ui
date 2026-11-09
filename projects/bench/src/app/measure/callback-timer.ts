/*
 * How long a page's animation-frame callbacks run, frame by frame: `requestAnimationFrame` is
 * wrapped while the timer is installed, so each callback asked for in that time is timed, and the
 * callbacks of one frame (those given the same frame time) add up into one slot of a typed array
 * allocated once. It times what the page's own frames cost (a canvas's draw, change detection the
 * frames start) from outside, through the browser's API, so the bench reaches into nothing it
 * measures. A raw-browser-API unit (AGENTS.md): no Angular, no signals; the window is injected so
 * the specs run on a fake.
 */

/** What the timer wraps: the window's `requestAnimationFrame`, or a fake's. */
export interface FrameHost {
  requestAnimationFrame(callback: FrameRequestCallback): number;
}

export class CallbackTimer {
  private readonly durations: Float64Array;
  private count = 0;
  /** The frame time of the slot being added to; NaN before the first. */
  private frameTime = Number.NaN;
  private original: FrameHost['requestAnimationFrame'] | null = null;

  constructor(
    private readonly host: FrameHost = window,
    capacity = 4096,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.durations = new Float64Array(capacity);
  }

  /** Frames timed so far (up to the capacity; later ones run untimed). */
  get timed(): number {
    return Math.min(this.count, this.durations.length);
  }

  /** Starts timing every callback asked for from now on. */
  install(): void {
    if (this.original) return;
    const original = this.host.requestAnimationFrame;
    this.original = original;
    this.host.requestAnimationFrame = (callback: FrameRequestCallback) =>
      original.call(this.host, (time) => {
        const start = this.now();
        try {
          callback(time);
        } finally {
          if (time !== this.frameTime) {
            this.frameTime = time;
            this.count++;
            if (this.count <= this.durations.length) this.durations[this.count - 1] = 0;
          }
          if (this.count <= this.durations.length) {
            this.durations[this.count - 1] += this.now() - start;
          }
        }
      });
  }

  /** Puts the window's own `requestAnimationFrame` back. */
  uninstall(): void {
    if (!this.original) return;
    this.host.requestAnimationFrame = this.original;
    this.original = null;
  }

  /** Forgets what was timed, for a measurement that starts now. */
  reset(): void {
    this.count = 0;
    this.frameTime = Number.NaN;
  }

  /** Each frame's callbacks' time since the last reset, ms, in order. */
  results(): Float64Array {
    return this.durations.slice(0, this.timed);
  }
}
