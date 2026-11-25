import { FollowScroll } from './follow-scroll';

/** A scrolling box whose sizes the test sets; a scroll is the reader's or the code's, at once. */
class FakeBox extends EventTarget {
  scrollHeight = 1000;
  clientHeight = 400;
  private top = 600;
  smooth: boolean[] = [];

  get scrollTop(): number {
    return this.top;
  }
  set scrollTop(value: number) {
    this.top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight));
    this.dispatchEvent(new Event('scroll'));
  }
  scrollTo(options: ScrollToOptions): void {
    this.smooth.push(options.behavior === 'smooth');
    this.scrollTop = options.top ?? this.top;
  }
  /** The box got shorter: the browser clamps `scrollTop` to the new end and fires `scroll`. */
  clamp(): void {
    this.scrollTop = this.top;
  }
  /** The reader scrolls to `top`. */
  readerScrolls(top: number): void {
    this.scrollTop = top;
  }
  get atBottom(): boolean {
    return this.top === this.scrollHeight - this.clientHeight;
  }
}

function follow(reduced = false) {
  const box = new FakeBox();
  const away: boolean[] = [];
  const scroll = new FollowScroll(
    box as unknown as HTMLElement,
    (value) => away.push(value),
    () => reduced,
  );
  return { box, away, scroll };
}

describe('FollowScroll', () => {
  it('follows while near the bottom', () => {
    const { box, scroll } = follow();
    box.scrollHeight = 1200;
    scroll.contentChanged();
    expect(box.atBottom).toBe(true);
    box.readerScrolls(box.scrollTop - 40);
    box.scrollHeight = 1400;
    scroll.contentChanged();
    expect(box.atBottom).toBe(true);
    scroll.destroy();
  });

  it('stops following once the reader scrolls up more than 48 px and reports away', () => {
    const { box, away, scroll } = follow();
    box.readerScrolls(500);
    expect(away).toEqual([true]);
    box.scrollHeight = 1300;
    scroll.contentChanged();
    expect(box.scrollTop).toBe(500);
    scroll.destroy();
  });

  it('follows again once the reader scrolls back to the bottom', () => {
    const { box, away, scroll } = follow();
    box.readerScrolls(500);
    box.readerScrolls(590);
    expect(away).toEqual([true, false]);
    box.scrollHeight = 1300;
    scroll.contentChanged();
    expect(box.atBottom).toBe(true);
    scroll.destroy();
  });

  it('latest scrolls to the end and follows again', () => {
    const { box, away, scroll } = follow();
    box.readerScrolls(100);
    scroll.latest();
    expect(box.atBottom).toBe(true);
    expect(box.smooth).toEqual([true]);
    expect(away).toEqual([true, false]);
    box.scrollHeight = 1300;
    scroll.contentChanged();
    expect(box.atBottom).toBe(true);
    scroll.destroy();
  });

  it('latest jumps under reduced motion', () => {
    const { box, scroll } = follow(true);
    box.readerScrolls(100);
    scroll.latest();
    expect(box.smooth).toEqual([false]);
    scroll.destroy();
  });

  it('a box that grows while following, which the browser clamps, does not count as the reader', () => {
    const { box, away, scroll } = follow();
    box.scrollHeight = 900;
    box.clamp();
    expect(away).toEqual([]);
    scroll.destroy();
  });

  it('destroy stops listening', () => {
    const { box, away, scroll } = follow();
    scroll.destroy();
    box.readerScrolls(100);
    expect(away).toEqual([]);
  });
});
