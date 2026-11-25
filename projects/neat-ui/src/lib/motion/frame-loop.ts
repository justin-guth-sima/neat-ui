import type { FrameClock } from './eased';

/** How soon after the page shows again something seen counts as what came while it was hidden. */
const BACK_IN_VIEW_MS = 100;

/** What a frame loop runs by: its clock, the document whose visibility it follows, and its end. */
export interface FrameLoopHost {
  readonly clock: FrameClock;
  readonly document: Document;
  /** Called when a frame leaves nothing to move. */
  readonly stopped?: () => void;
}

/**
 * A motion's frames: one at a time while `wanted` says there is something to move, never while
 * the page is hidden; back in view, it starts again by itself. When a frame leaves nothing to
 * move, it tells the host's `stopped`. Shared by the kit's motions (the text motions, the picture
 * reading, the listening and speaking motions). Internal.
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
    private readonly deps: FrameLoopHost,
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
      else this.deps.stopped?.();
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

  /** Cancels the frame waiting and stops following the page's visibility. */
  destroy(): void {
    if (this.handle !== null) this.deps.clock.cancel(this.handle);
    this.handle = null;
    this.deps.document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
