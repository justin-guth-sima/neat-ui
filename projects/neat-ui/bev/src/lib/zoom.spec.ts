import type { ZoomTransform } from 'd3-zoom';
import { plotArea, ZOOM_MAX } from './geometry';
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
    zoom.setPlot(plotArea(600, 400, 'round'));
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

  it('zooms about the plot centre with + and -, within its limits', () => {
    expect(key('+').defaultPrevented).toBe(true);
    const zoomed = zoom.transform;
    expect(zoomed.k).toBeCloseTo(1.25);
    // The plot's centre stays where it is.
    expect(zoomed.apply([300, 200])).toEqual([300, 200]);
    for (let i = 0; i < 20; i++) key('=');
    expect(zoom.transform.k).toBe(ZOOM_MAX);
    for (let i = 0; i < 20; i++) key('-');
    expect(zoom.transform.k).toBe(1);
    expect(seen.at(-1)).toBe(zoom.transform);
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
    // However far it goes, the plot's edge stops it: the plot's left edge (100) stays at or
    // left of the screen's plot edge.
    for (let i = 0; i < 50; i++) key('ArrowLeft');
    expect(zoom.transform.apply([100, 200])[0]).toBeCloseTo(100);
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
    key('+');
    key('+');
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
    zoom.setPlot(plotArea(300, 400, 'round'));
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
    zoom.setPlot(plotArea(600, 400, 'round'));
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
