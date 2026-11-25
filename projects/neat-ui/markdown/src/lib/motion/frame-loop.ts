import type { MotionHost } from './engine';

/** How soon after the page shows again a piece counts as text that came while it was hidden. */
const BACK_IN_VIEW_MS = 100;

/**
 * An engine's frames: one at a time while `wanted` says there is something to move, never while
 * the page is hidden; back in view, it starts again by itself. When a frame leaves nothing to
 * move, it tells the host's `stopped`. Internal.
 */
export class FrameLoop {
  private handle: number | null = null;
  private shownAt = Number.NEGATIVE_INFINITY;
  private readonly onVisibility = () => {
    if (this.deps.document.hidden) return;
    this.shownAt = this.deps.clock.now();
    this.start();
  };

  /**
   * @param frame draws one frame.
   * @param wanted whether there is something to move.
   */
  constructor(
    private readonly deps: MotionHost,
    private readonly frame: () => void,
    private readonly wanted: () => boolean,
  ) {
    deps.document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Requests a frame if there is something to move and none is waiting. */
  start(): void {
    if (this.handle !== null || this.deps.document.hidden || !this.wanted()) return;
    this.handle = this.deps.clock.request(() => {
      this.handle = null;
      if (this.deps.document.hidden) return;
      this.frame();
      if (this.wanted()) this.start();
      else this.deps.stopped();
    });
  }

  /** Whether there is something to move. */
  get active(): boolean {
    return this.wanted();
  }

  /**
   * Whether a piece seen now arrived where the page showed it: not while hidden, nor in the first
   * moment back in view, when what came meanwhile renders at once and is simply there.
   */
  fresh(): boolean {
    return !this.deps.document.hidden && this.deps.clock.now() - this.shownAt > BACK_IN_VIEW_MS;
  }

  destroy(): void {
    if (this.handle !== null) this.deps.clock.cancel(this.handle);
    this.handle = null;
    this.deps.document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
