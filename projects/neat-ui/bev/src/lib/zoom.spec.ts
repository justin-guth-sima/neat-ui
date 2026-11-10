import type { ZoomTransform } from 'd3-zoom';
import { type ScreenRect, ZOOM_EXTENT } from './geometry';
import { BevZoom, isDefault } from './zoom';

/** `matchMedia` answering the reduced-motion query, so moves jump instead of animating. */
function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

/**
 * A mouse event at (clientX, clientY). d3-zoom follows a press on the event's window; jsdom
 * refuses its own window as `view` in the constructor, so it is set afterwards.
 */
function mouse(type: string, clientX: number, clientY: number): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(event, 'view', { value: window });
  return event;
}

/** The round plot in the middle 400 × 400 of a 600 × 400 box: where the view pans. */
const PLOT: ScreenRect = [
  [100, 0],
  [500, 400],
];

describe('BevZoom', () => {
  let box: HTMLElement;
  let zoom: BevZoom;
  let seen: ZoomTransform[];

  /** A 600 × 400 box with the round plot in its middle 400 × 400. */
  beforeEach(() => {
    stubReducedMotion(true);
    box = document.createElement('div');
    box.tabIndex = 0;
    document.body.append(box);
    Object.defineProperty(box, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 400 });
    seen = [];
    zoom = new BevZoom(box, (t) => seen.push(t));
    zoom.setBounds(600, 400, PLOT);
  });

  afterEach(() => {
    zoom.destroy();
    box.remove();
    vi.unstubAllGlobals();
  });

  const key = (name: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
      key: name,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    box.dispatchEvent(event);
    return event;
  };

  it('starts at the default view', () => {
    expect(isDefault(zoom.transform)).toBe(true);
  });

  it('zooms about the plot center with + and -, within its limits', () => {
    expect(key('+').defaultPrevented).toBe(true);
    const zoomed = zoom.transform;
    expect(zoomed.k).toBeCloseTo(1.25);
    // The plot's center stays where it is.
    expect(zoomed.apply([300, 200])).toEqual([300, 200]);
    for (let i = 0; i < 20; i++) key('=');
    expect(zoom.transform.k).toBe(ZOOM_EXTENT[1]);
    for (let i = 0; i < 20; i++) key('-');
    expect(zoom.transform.k).toBe(1);
    expect(seen.at(-1)).toBe(zoom.transform);
  });

  it('zooms within the limits it is given, out beyond the default view too', () => {
    zoom.setScaleExtent(0.5, 2);
    for (let i = 0; i < 20; i++) key('-');
    expect(zoom.transform.k).toBe(0.5);
    // Zoomed out, the plot is smaller than the box: it stays in the middle.
    expect(zoom.transform.apply([300, 200])[0]).toBeCloseTo(300);
    for (let i = 0; i < 20; i++) key('+');
    expect(zoom.transform.k).toBe(2);
    // Narrower limits bring the view back within them.
    zoom.setScaleExtent(1, 1.5);
    expect(zoom.transform.k).toBe(1.5);
  });

  it('pans with the arrows only within the plot', () => {
    // At the default zoom the whole plot is in view: nowhere to pan.
    key('ArrowLeft');
    expect(isDefault(zoom.transform)).toBe(true);
    key('+');
    key('+');
    key('ArrowLeft');
    const panned = zoom.transform;
    expect(panned.x).toBeGreaterThan(300 * (1 - panned.k));
    // However far it goes, the plot's edge stops it at the box's: the plot grows past the box,
    // and its left edge (100) comes no further right than the box's left edge.
    for (let i = 0; i < 50; i++) key('ArrowLeft');
    expect(zoom.transform.apply([100, 200])[0]).toBeCloseTo(0);
  });

  it('keeps the plot in the middle while it is narrower than the box', () => {
    key('+');
    for (let i = 0; i < 50; i++) key('ArrowLeft');
    // 1.25 × 400 = 500 px wide in a 600 px box: no room to pan sideways.
    expect(zoom.transform.apply([300, 200])[0]).toBeCloseTo(300);
  });

  it('takes every wheel over the box, at the zoom limits too, and none once destroyed', () => {
    const wheel = (deltaY: number) => {
      const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
      box.dispatchEvent(event);
      return event.defaultPrevented;
    };
    // Zoomed out as far as it goes, a wheel out changes nothing; the page still must not scroll.
    expect(wheel(100)).toBe(true);
    for (let i = 0; i < 20; i++) key('=');
    expect(wheel(-100)).toBe(true);
    zoom.destroy();
    expect(wheel(100)).toBe(false);
    expect(box.style.getPropertyValue('-webkit-tap-highlight-color')).toBe('');
  });

  it('resets with 0', () => {
    key('+');
    key('ArrowUp');
    key('0');
    expect(isDefault(zoom.transform)).toBe(true);
  });

  it('leaves keys with a modifier, and keys on what the box holds, to others', () => {
    expect(key('+', { ctrlKey: true }).defaultPrevented).toBe(false);
    const inner = document.createElement('button');
    box.append(inner);
    const event = new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true });
    inner.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(zoom.transform.k).toBe(1);
  });

  it('pans by dragging once zoomed', () => {
    // Zoomed until the plot is wider than the box, so that it has room to pan sideways.
    for (let i = 0; i < 4; i++) key('+');
    const before = zoom.transform;
    box.dispatchEvent(mouse('mousedown', 300, 200));
    window.dispatchEvent(mouse('mousemove', 320, 210));
    window.dispatchEvent(mouse('mouseup', 320, 210));
    expect(zoom.transform.x).toBeCloseTo(before.x + 20);
    expect(zoom.transform.y).toBeCloseTo(before.y + 10);
  });

  it('keeps the zoom on a new plot, moved back inside it', () => {
    key('+');
    key('+');
    for (let i = 0; i < 50; i++) key('ArrowLeft');
    // The box narrows: the plot is now 300 × 300 around (150, 200).
    zoom.setBounds(300, 400, [
      [0, 50],
      [300, 350],
    ]);
    const t = zoom.transform;
    expect(t.k).toBeCloseTo(1.5625);
    expect(t.apply([0, 200])[0]).toBeLessThanOrEqual(0 + 1e-9);
    expect(t.apply([300, 200])[0]).toBeGreaterThanOrEqual(300 - 1e-9);
  });

  it('animates a key zoom and the reset over 250 ms unless motion is reduced', () => {
    stubReducedMotion(false);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    zoom.destroy();
    zoom = new BevZoom(box, () => undefined);
    zoom.setBounds(600, 400, PLOT);
    const run = (at: number) => {
      now = at;
      frames.splice(0).forEach((frame) => frame(at));
    };

    key('+');
    expect(zoom.transform.k).toBe(1);
    run(125);
    expect(zoom.transform.k).toBeGreaterThan(1);
    expect(zoom.transform.k).toBeLessThan(1.25);
    run(250);
    expect(zoom.transform.k).toBeCloseTo(1.25);
    expect(frames).toHaveLength(0);

    zoom.reset();
    run(375);
    run(500);
    expect(isDefault(zoom.transform)).toBe(true);
  });
});
