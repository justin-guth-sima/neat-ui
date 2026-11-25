/**
 * The frame the listening motions were designed at, 60 a second: a step the mockups take "each
 * frame" is a step of this time, so the motions keep their speed on a faster or slower screen.
 */
export const DESIGN_FRAME_MS = 1000 / 60;

/**
 * When a series taken every `ms` takes its next sample, on the frames there are: at most one a
 * frame, a quarter period early still counting (a frame's timing jitters, and a sample that just
 * missed would wait a whole frame), and after a gap (a hidden page) on from then, with no
 * catch-up. Internal.
 */
export class Sampler {
  private due = 0;

  constructor(private readonly ms: number) {}

  /** Starts a new series: the first frame from `now` takes a sample. */
  reset(now: number): void {
    this.due = now;
  }

  /** Whether the frame at `now` takes a sample. */
  take(now: number): boolean {
    if (now < this.due - this.ms / 4) return false;
    this.due = now >= this.due + this.ms ? now + this.ms : this.due + this.ms;
    return true;
  }
}
