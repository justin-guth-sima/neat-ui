import { FollowScroll } from './follow-scroll';

/** A scrolling box whose sizes the test sets; a scroll is the reader's or the code's, at once. */
class FakeBox extends EventTarget {
  readonly firstElementChild = new EventTarget();
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
    box.scrollHeight = 1400;
    scroll.contentChanged();
    expect(box.atBottom).toBe(true);
    scroll.destroy();
  });

  it('lets go on a scroll up away from the end, however small, as a wheel tick starts', () => {
    const { box, away, scroll } = follow();
    box.readerScrolls(box.scrollTop - 20);
    expect(away).toEqual([true]);
    box.scrollHeight = 1300;
    scroll.contentChanged();
    expect(box.scrollTop).toBe(580);
    scroll.destroy();
  });

  it('lets go on a wheel turned up, before any scroll comes, so the next piece does not pull back', () => {
    const { box, away, scroll } = follow();
    box.dispatchEvent(Object.assign(new Event('wheel'), { deltaY: -100 }));
    expect(away).toEqual([true]);
    box.scrollHeight = 1300;
    scroll.contentChanged();
    expect(box.scrollTop).toBe(600);
    scroll.destroy();
  });

  it('a wheel turned up does not let go of a box with nothing to scroll', () => {
    const { box, away, scroll } = follow();
    box.scrollHeight = 400;
    box.dispatchEvent(Object.assign(new Event('wheel'), { deltaY: -100 }));
    box.dispatchEvent(Object.assign(new Event('keydown'), { key: 'PageUp' }));
    expect(away).toEqual([]);
    scroll.destroy();
  });

  it('a wheel turned down does not let go', () => {
    const { box, away, scroll } = follow();
    box.dispatchEvent(Object.assign(new Event('wheel'), { deltaY: 100 }));
    expect(away).toEqual([]);
    scroll.destroy();
  });

  it('lets go on the keys that scroll up', () => {
    for (const key of ['ArrowUp', 'PageUp', 'Home']) {
      const { box, away, scroll } = follow();
      box.dispatchEvent(Object.assign(new Event('keydown'), { key }));
      expect(away, key).toEqual([true]);
      scroll.destroy();
    }
  });

  it('follows again within 48 px of the end, scrolling down', () => {
    const { box, away, scroll } = follow();
    box.readerScrolls(400);
    box.readerScrolls(560);
    expect(away).toEqual([true, false]);
    scroll.destroy();
  });

  it('follows growth it is not told about, such as a picture that loads', () => {
    const observers: { callback: ResizeObserverCallback; targets: unknown[] }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        readonly targets: unknown[] = [];
        constructor(callback: ResizeObserverCallback) {
          observers.push({ callback, targets: this.targets });
        }
        observe(target: unknown) {
          this.targets.push(target);
        }
        disconnect() {
          this.targets.length = 0;
        }
      },
    );
    const { box, scroll } = follow();
    expect(observers[0].targets).toEqual([box, box.firstElementChild]);
    box.scrollHeight = 1500;
    observers[0].callback([], {} as ResizeObserver);
    expect(box.atBottom).toBe(true);
    scroll.destroy();
    expect(observers[0].targets).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('resume follows again at once, without a smooth scroll', () => {
    const { box, away, scroll } = follow();
    box.readerScrolls(100);
    box.scrollHeight = 1300;
    scroll.resume();
    expect(box.atBottom).toBe(true);
    expect(box.smooth).toEqual([]);
    expect(away).toEqual([true, false]);
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
