/** How close to the bottom (px) counts as back at the bottom, so the box follows again. */
export const FOLLOW_SLACK_PX = 48;

/**
 * Keeps a scrolling box at its newest content while the reader is there, and lets go as soon as
 * they scroll up: the transcript's follow rule, kept apart from Angular (a scroll listener, a
 * `ResizeObserver` and `scrollTop`, outside change detection).
 *
 * Scrolling up lets go: a wheel turned up, a key that scrolls up (ArrowUp, PageUp, Home) and a
 * finger dragging let go at once, before their scroll arrives (the browser animates it over
 * several frames, and the next piece's jump to the end would cancel it), and any scroll up away
 * from the end, however small, lets go too.
 * Content that grows, a clamp by the browser (which lands at the end) and the box's own scroll to
 * the end never let go, since none of them moves the box up away from the end. Coming back within
 * `FOLLOW_SLACK_PX` of the end, by scrolling down, `latest()` or `resume()`, follows again.
 * `onAway` is told each change.
 *
 * While following, growth the app does not announce (a picture that loads, code that is colored,
 * a box that shrinks) is followed too: the box and its first child are observed for size.
 */
export class FollowScroll {
  private following = true;
  private lastTop: number;
  private readonly sizes: ResizeObserver | null;

  constructor(
    private readonly box: HTMLElement,
    private readonly onAway: (away: boolean) => void,
    private readonly reducedMotion: () => boolean,
  ) {
    this.lastTop = box.scrollTop;
    box.addEventListener('scroll', this.onScroll, { passive: true });
    box.addEventListener('wheel', this.onWheel, { passive: true });
    box.addEventListener('keydown', this.onKey);
    box.addEventListener('touchmove', this.onTouch, { passive: true });
    this.sizes =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => this.contentChanged());
    this.sizes?.observe(box);
    if (box.firstElementChild) this.sizes?.observe(box.firstElementChild);
  }

  /** The content changed: stay at the end while following. */
  contentChanged(): void {
    if (this.following) this.toEnd();
  }

  /** Back to the end (smoothly unless reduced motion is on), and follow again. */
  latest(): void {
    this.setFollowing(true);
    this.box.scrollTo({
      top: this.box.scrollHeight,
      behavior: this.reducedMotion() ? 'auto' : 'smooth',
    });
  }

  /** Back to the end at once, and follow again: for something the reader did, such as sending. */
  resume(): void {
    this.setFollowing(true);
    this.toEnd();
  }

  destroy(): void {
    this.box.removeEventListener('scroll', this.onScroll);
    this.box.removeEventListener('wheel', this.onWheel);
    this.box.removeEventListener('keydown', this.onKey);
    this.box.removeEventListener('touchmove', this.onTouch);
    this.sizes?.disconnect();
  }

  private toEnd(): void {
    this.box.scrollTop = this.box.scrollHeight;
    this.lastTop = this.box.scrollTop;
  }

  private readonly onScroll = (): void => {
    const top = this.box.scrollTop;
    const movedUp = top < this.lastTop;
    this.lastTop = top;
    const distance = this.box.scrollHeight - this.box.clientHeight - top;
    // A clamp moves up only as far as the end, so it lands at no distance from it.
    if (movedUp && distance > 1) this.setFollowing(false);
    else if (distance <= FOLLOW_SLACK_PX) this.setFollowing(true);
  };

  // The reader's intent lets go before their scroll arrives: a browser animates a wheel tick or a
  // key's scroll over several frames, and the next piece's jump to the end would cancel it first.
  private readonly onWheel = (event: WheelEvent): void => {
    if (event.deltaY < 0) this.setFollowing(false);
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'Home') {
      this.setFollowing(false);
    }
  };

  private readonly onTouch = (): void => this.setFollowing(false);

  private setFollowing(following: boolean): void {
    if (following === this.following) return;
    this.following = following;
    this.onAway(!following);
  }
}
