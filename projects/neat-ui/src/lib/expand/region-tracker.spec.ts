import { regionBox, type RegionTrackerEnv, trackRegion } from './region-tracker';

/** A ResizeObserver the spec drives: jsdom lays nothing out, so the spec says what changed. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  fire(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

/** A MutationObserver the spec drives, as a DOM change somewhere in the document. */
class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];
  observed: { target: Node; options?: MutationObserverInit }[] = [];
  disconnected = false;

  constructor(private readonly callback: MutationCallback) {
    FakeMutationObserver.instances.push(this);
  }

  observe(target: Node, options?: MutationObserverInit): void {
    this.observed.push({ target, options });
  }

  disconnect(): void {
    this.disconnected = true;
  }

  fire(): void {
    this.callback([], this as unknown as MutationObserver);
  }
}

/** Frames the spec steps by hand. */
function fakeFrames() {
  let next = 1;
  const pending = new Map<number, () => void>();
  return {
    pending,
    clock: {
      now: () => 0,
      request: (callback: () => void) => {
        pending.set(next, callback);
        return next++;
      },
      cancel: (handle: number) => void pending.delete(handle),
    },
    /** Runs the frame's callbacks, as the browser does before it paints. */
    step(): void {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
  };
}

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect;

describe('trackRegion', () => {
  let region: HTMLElement;
  let host: HTMLElement;
  let box: ReturnType<typeof vi.fn<() => DOMRect>>;
  let frames: ReturnType<typeof fakeFrames>;
  let events: EventTarget;
  let env: RegionTrackerEnv;

  const placed = () => ({
    top: host.style.getPropertyValue('--neat-expand-top'),
    left: host.style.getPropertyValue('--neat-expand-left'),
    width: host.style.getPropertyValue('--neat-expand-width'),
    height: host.style.getPropertyValue('--neat-expand-height'),
  });

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    FakeMutationObserver.instances = [];
    region = document.createElement('div');
    host = document.createElement('div');
    document.body.append(region, host);
    box = vi.fn(() => rect(240, 56, 800, 600));
    region.getBoundingClientRect = box;
    frames = fakeFrames();
    events = new EventTarget();
    env = {
      events,
      frames: frames.clock,
      ResizeObserver: FakeResizeObserver as unknown as typeof ResizeObserver,
      MutationObserver: FakeMutationObserver as unknown as typeof MutationObserver,
    };
  });

  afterEach(() => {
    region.remove();
    host.remove();
  });

  it('places the host over the region’s border box at once, before any frame', () => {
    trackRegion(region, host, vi.fn(), env);

    expect(placed()).toEqual({ top: '56px', left: '240px', width: '800px', height: '600px' });
  });

  it('gives the host the region’s rounded corners', () => {
    region.style.borderRadius = '12px';

    trackRegion(region, host, vi.fn(), env);

    expect(host.style.getPropertyValue('--neat-expand-radius')).toBe('12px');
  });

  it('follows the region on the next frame when it resizes', () => {
    trackRegion(region, host, vi.fn(), env);
    const [observer] = FakeResizeObserver.instances;
    expect(observer.observed).toEqual([region]);

    box.mockReturnValue(rect(240, 56, 448, 600));
    observer.fire();
    expect(placed().width).toBe('800px');
    frames.step();

    expect(placed()).toEqual({ top: '56px', left: '240px', width: '448px', height: '600px' });
  });

  it('follows the region on the next frame when the window resizes', () => {
    trackRegion(region, host, vi.fn(), env);

    box.mockReturnValue(rect(0, 104, 390, 700));
    events.dispatchEvent(new Event('resize'));
    frames.step();

    expect(placed()).toEqual({ top: '104px', left: '0px', width: '390px', height: '700px' });
  });

  it('follows the region on the next frame when anything scrolls, the region’s boxes included', () => {
    const listen = vi.spyOn(events, 'addEventListener');
    trackRegion(region, host, vi.fn(), env);
    // Capturing, since a scroll event does not bubble from the box that scrolls.
    expect(listen).toHaveBeenCalledWith('scroll', expect.any(Function), {
      capture: true,
      passive: true,
    });

    box.mockReturnValue(rect(240, -144, 800, 600));
    events.dispatchEvent(new Event('scroll'));
    frames.step();

    expect(placed().top).toBe('-144px');
  });

  it('measures once a frame however many changes come in it', () => {
    trackRegion(region, host, vi.fn(), env);
    box.mockClear();

    FakeResizeObserver.instances[0].fire();
    events.dispatchEvent(new Event('resize'));
    events.dispatchEvent(new Event('scroll'));
    expect(frames.pending.size).toBe(1);
    frames.step();

    expect(box).toHaveBeenCalledTimes(1);
  });

  it('writes nothing in a frame where the region has not moved', () => {
    trackRegion(region, host, vi.fn(), env);
    const write = vi.spyOn(host.style, 'setProperty');

    events.dispatchEvent(new Event('scroll'));
    frames.step();

    expect(write).not.toHaveBeenCalled();
  });

  it('says the region is gone when it leaves the document', () => {
    const gone = vi.fn();
    trackRegion(region, host, gone, env);
    const [mutations] = FakeMutationObserver.instances;
    expect(mutations.observed).toEqual([
      { target: document, options: { childList: true, subtree: true } },
    ]);

    region.remove();
    mutations.fire();
    expect(gone).not.toHaveBeenCalled();
    frames.step();

    expect(gone).toHaveBeenCalledTimes(1);
  });

  it('says the region is gone when it is hidden', () => {
    const gone = vi.fn();
    trackRegion(region, host, gone, env);

    // `display: none` leaves no box, which the ResizeObserver reports as a size of nothing.
    box.mockReturnValue(rect(0, 0, 0, 0));
    FakeResizeObserver.instances[0].fire();
    frames.step();

    expect(gone).toHaveBeenCalledTimes(1);
  });

  it('says the region is gone when it has no width or no height', () => {
    const gone = vi.fn();
    trackRegion(region, host, gone, env);

    box.mockReturnValue(rect(240, 56, 800, 0));
    FakeResizeObserver.instances[0].fire();
    frames.step();

    expect(gone).toHaveBeenCalledTimes(1);
  });

  it('stops: no listener, observer or frame is left', () => {
    const unlisten = vi.spyOn(events, 'removeEventListener');
    const stop = trackRegion(region, host, vi.fn(), env);
    events.dispatchEvent(new Event('resize'));

    stop();

    expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
    expect(FakeMutationObserver.instances[0].disconnected).toBe(true);
    expect(unlisten).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(unlisten).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(frames.pending.size).toBe(0);
  });

  it('follows the window’s resizes and scrolls alone where the browser has no observers', () => {
    trackRegion(region, host, vi.fn(), {
      ...env,
      ResizeObserver: undefined,
      MutationObserver: undefined,
    });

    box.mockReturnValue(rect(240, 56, 448, 600));
    events.dispatchEvent(new Event('resize'));
    frames.step();

    expect(placed().width).toBe('448px');
  });
});

describe('regionBox', () => {
  it('is the element’s border box in the window', () => {
    const element = document.createElement('div');
    document.body.append(element);
    element.getBoundingClientRect = () => rect(8, 16, 320, 180);

    expect(regionBox(element)).toEqual({ top: 16, left: 8, width: 320, height: 180 });
    element.remove();
  });

  it('is null for an element out of the document or with nothing to cover', () => {
    const element = document.createElement('div');
    element.getBoundingClientRect = () => rect(8, 16, 320, 180);
    expect(regionBox(element)).toBeNull();

    document.body.append(element);
    element.getBoundingClientRect = () => rect(0, 0, 0, 0);
    expect(regionBox(element)).toBeNull();
    element.remove();
  });
});
