import { trackAnchor } from './tracking';

/** Observers that record what they watch and let a spec call them back. */
class FakeResizeObserver {
  static last: FakeResizeObserver | undefined;
  readonly watched: Element[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) {
    FakeResizeObserver.last = this;
  }
  observe(element: Element) {
    this.watched.push(element);
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeIntersectionObserver {
  static last: FakeIntersectionObserver | undefined;
  readonly watched: Element[] = [];
  disconnected = false;
  constructor(
    readonly callback: (entries: { target: Element; isIntersecting: boolean }[]) => void,
  ) {
    FakeIntersectionObserver.last = this;
  }
  observe(element: Element) {
    this.watched.push(element);
  }
  disconnect() {
    this.disconnected = true;
  }
}

describe('trackAnchor', () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const runFrames = () => frames.splice(0).forEach((frame) => frame(0));

  function track() {
    const anchors = [document.createElement('mark'), document.createElement('mark')];
    const bubble = document.createElement('div');
    const place = vi.fn();
    const shown = vi.fn();
    const stop = trackAnchor(window, anchors, bubble, place, shown);
    return { anchors, bubble, place, shown, stop };
  }

  it('places again once a frame after any scroll, a resize of the window, the bubble or an anchor', () => {
    const { anchors, bubble, place } = track();
    expect(FakeResizeObserver.last?.watched).toEqual([bubble, ...anchors]);

    document.body.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    FakeResizeObserver.last?.callback();
    expect(place).not.toHaveBeenCalled();
    runFrames();
    expect(place).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event('scroll'));
    runFrames();
    expect(place).toHaveBeenCalledTimes(2);
  });

  it('shows the bubble while any anchor element is in view', () => {
    const { anchors, shown } = track();
    const observer = FakeIntersectionObserver.last!;
    expect(observer.watched).toEqual(anchors);

    observer.callback([{ target: anchors[0], isIntersecting: true }]);
    expect(shown).toHaveBeenLastCalledWith(true);
    observer.callback([
      { target: anchors[0], isIntersecting: false },
      { target: anchors[1], isIntersecting: true },
    ]);
    expect(shown).toHaveBeenLastCalledWith(true);
    observer.callback([{ target: anchors[1], isIntersecting: false }]);
    expect(shown).toHaveBeenLastCalledWith(false);
  });

  it('stops listening and observing when stopped', () => {
    const { place, stop } = track();
    document.dispatchEvent(new Event('scroll'));
    stop();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(FakeResizeObserver.last?.disconnected).toBe(true);
    expect(FakeIntersectionObserver.last?.disconnected).toBe(true);

    frames.splice(0);
    document.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    expect(frames).toEqual([]);
    expect(place).not.toHaveBeenCalled();
  });

  it('works without the observers, the bubble then always shown', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('IntersectionObserver', undefined);
    const { place, shown, stop } = track();
    document.dispatchEvent(new Event('scroll'));
    runFrames();
    expect(place).toHaveBeenCalledTimes(1);
    expect(shown).not.toHaveBeenCalled();
    stop();
  });
});
