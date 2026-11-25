/** How close to the bottom (px) still counts as at the bottom, so the box keeps following. */
export const FOLLOW_SLACK_PX = 48;

/**
 * Keeps a scrolling box at its newest content while the reader is there, and lets go once they
 * scroll up: the transcript's follow rule, kept apart from Angular (a scroll listener and
 * `scrollTop`, outside change detection).
 *
 * Only the reader's scrolling up lets go: content that grows, a clamp by the browser and the
 * box's own scroll to the end never do, since none of them moves the box up. Coming back within
 * `FOLLOW_SLACK_PX` of the bottom, by scrolling or by `latest()`, follows again. `onAway` is told
 * each change.
 */
export class FollowScroll {
  private following = true;
  private lastTop: number;

  constructor(
    private readonly box: HTMLElement,
    private readonly onAway: (away: boolean) => void,
    private readonly reducedMotion: () => boolean,
  ) {
    this.lastTop = box.scrollTop;
    box.addEventListener('scroll', this.onScroll, { passive: true });
  }

  /** The content changed: stay at the end while following. */
  contentChanged(): void {
    if (this.following) this.box.scrollTop = this.box.scrollHeight;
  }

  /** Back to the end (smoothly unless reduced motion is on), and follow again. */
  latest(): void {
    this.setFollowing(true);
    this.box.scrollTo({
      top: this.box.scrollHeight,
      behavior: this.reducedMotion() ? 'auto' : 'smooth',
    });
  }

  destroy(): void {
    this.box.removeEventListener('scroll', this.onScroll);
  }

  private readonly onScroll = (): void => {
    const top = this.box.scrollTop;
    const movedUp = top < this.lastTop;
    this.lastTop = top;
    const distance = this.box.scrollHeight - this.box.clientHeight - top;
    // A clamp by the browser moves up only as far as the end, so it never lands away from it.
    if (distance <= FOLLOW_SLACK_PX) this.setFollowing(true);
    else if (movedUp) this.setFollowing(false);
  };

  private setFollowing(following: boolean): void {
    if (following === this.following) return;
    this.following = following;
    this.onAway(!following);
  }
}
