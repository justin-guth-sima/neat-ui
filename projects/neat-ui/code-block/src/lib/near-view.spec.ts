import { NEAR_MARGIN, watchNearView } from './near-view';
import { FakeIntersectionObserver } from './near-view.testing';

describe('watchNearView', () => {
  beforeEach(() => vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver));
  afterEach(() => {
    FakeIntersectionObserver.last = undefined;
    vi.unstubAllGlobals();
  });

  it('watches the element with a margin around the view and around every box that scrolls it', () => {
    const element = document.createElement('div');
    watchNearView(window, element, vi.fn());
    const observer = FakeIntersectionObserver.last!;

    expect(observer.watched).toEqual([element]);
    expect(observer.options).toEqual({ rootMargin: NEAR_MARGIN, scrollMargin: NEAR_MARGIN });
  });

  it('says so once when the element comes near the view, and stops watching', () => {
    const element = document.createElement('div');
    const near = vi.fn();
    watchNearView(window, element, near);
    const observer = FakeIntersectionObserver.last!;

    observer.report(false);
    expect(near).not.toHaveBeenCalled();
    observer.report(true);
    expect(near).toHaveBeenCalledTimes(1);
    expect(observer.disconnected).toBe(true);
  });

  it('stops watching when stopped, and says nothing after', () => {
    const element = document.createElement('div');
    const near = vi.fn();
    const stop = watchNearView(window, element, near);
    stop();

    expect(FakeIntersectionObserver.last?.disconnected).toBe(true);
    expect(near).not.toHaveBeenCalled();
  });

  it('takes the element as near at once without an IntersectionObserver, or without a window', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const near = vi.fn();
    watchNearView(window, document.createElement('div'), near)();
    watchNearView(null, document.createElement('div'), near)();

    expect(near).toHaveBeenCalledTimes(2);
    expect(FakeIntersectionObserver.last).toBeUndefined();
  });
});
