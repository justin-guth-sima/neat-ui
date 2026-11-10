import { zoomTransform } from 'd3-zoom';
import { FIT_MARGIN, fitTransform, type FitTransform } from './fit';
import type { Rect } from './layout';
import { resize, stubResizeObserver, watched } from './resize-observer.testing';
import { DiagramZoom } from './zoom';

/** A level 420 × 140 from the origin; in an 800 × 600 box it fits at about 1.79. */
const EXTENT: Rect = { x: 0, y: 0, w: 420, h: 140 };

/** `matchMedia` answering the reduced-motion query with `reduce`. */
function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

/**
 * A mouse event at (clientX, clientY). d3-zoom follows a press on the event's window; Angular's
 * jsdom setup refuses its own window as `view` in the constructor, so it is set afterwards.
 */
function mouse(type: string, clientX: number, clientY: number): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(event, 'view', { value: window });
  return event;
}

/**
 * A box holding the content container and its edges' SVG, in the document, without a size (jsdom
 * lays out none).
 */
function setup() {
  const box = document.createElement('div');
  const content = document.createElement('div');
  const edges = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  content.append(edges);
  box.append(content);
  document.body.append(box);
  let w = 0;
  let h = 0;
  Object.defineProperty(box, 'clientWidth', { configurable: true, get: () => w });
  Object.defineProperty(box, 'clientHeight', { configurable: true, get: () => h });
  const zoom = new DiagramZoom(box, content, edges);
  return {
    box,
    content,
    edges,
    zoom,
    /** Gives the box a size and tells the observers, as a browser does after layout. */
    size(width: number, height: number) {
      w = width;
      h = height;
      resize(new Map([[box, { w: width, h: height }]]));
    },
    /** The transform d3-zoom holds for the box. */
    now: () => zoomTransform(box),
    key(key: string, init: KeyboardEventInit = {}, target: Element = box) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    },
    /** A wheel turn away from the user: zooms in 2^0.2× about the pointer (the box's corner). */
    /** A wheel turn over the box; true when the page's scroll was prevented. */
    wheel(deltaY = -100) {
      const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
      box.dispatchEvent(event);
      return event.defaultPrevented;
    },
    /** A mouse press at (10, 10), moved by (dx, dy) unless both are 0, then released. */
    drag(dx: number, dy: number) {
      this.press();
      if (dx || dy) window.dispatchEvent(mouse('mousemove', 10 + dx, 10 + dy));
      this.release(dx, dy);
    },
    press() {
      box.dispatchEvent(mouse('mousedown', 10, 10));
    },
    release(dx = 0, dy = 0) {
      window.dispatchEvent(mouse('mouseup', 10 + dx, 10 + dy));
    },
    teardown() {
      zoom.destroy();
      box.remove();
    },
  };
}

function expectAt(actual: FitTransform, expected: FitTransform | null): void {
  expect(expected).not.toBeNull();
  expect(actual.k).toBeCloseTo(expected!.k, 6);
  expect(actual.x).toBeCloseTo(expected!.x, 6);
  expect(actual.y).toBeCloseTo(expected!.y, 6);
}

const fitIn = (w: number, h: number, extent = EXTENT) => fitTransform(extent, { w, h });

describe('DiagramZoom', () => {
  let view: ReturnType<typeof setup>;

  beforeEach(() => {
    stubResizeObserver();
    stubReducedMotion(false);
    view = setup();
  });

  afterEach(() => {
    view.teardown();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('fitting by itself', () => {
    it('fits the level once the box has a size; without one (a hidden tab) it is at zoom 1', () => {
      view.zoom.setExtent(EXTENT);
      view.size(0, 0);
      expectAt(view.now(), { k: 1, x: 0, y: 0 });

      view.size(800, 600);

      expectAt(view.now(), fitIn(800, 600));
    });

    it('moves the content container by the transform, and gives the edges the zoom', () => {
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      const { k, x, y } = view.now();
      expect(view.content.style.transform).toBe(`translate(${x}px, ${y}px) scale(${k})`);
      // What keeps a width the same on screen at any zoom (an edge's hit path) divides by it. Only
      // the edges read it, so only they are restyled when it changes.
      expect(view.edges.style.getPropertyValue('--diagram-zoom')).toBe(String(k));
      expect(view.content.style.getPropertyValue('--diagram-zoom')).toBe('');
    });

    it('fits again when the box resizes and when the level’s extent changes', () => {
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);

      view.size(400, 300);
      expectAt(view.now(), fitIn(400, 300));

      const wider: Rect = { x: -100, y: 0, w: 900, h: 140 };
      view.zoom.setExtent(wider);
      expectAt(view.now(), fitIn(400, 300, wider));
    });

    it('fits nothing for an empty level, and the next level with something in it', () => {
      view.size(800, 600);
      view.zoom.setExtent(null);
      expectAt(view.now(), { k: 1, x: 0, y: 0 });

      view.zoom.setExtent(EXTENT);
      expectAt(view.now(), fitIn(800, 600));
    });

    it('leaves the view alone after the user zooms with the wheel', () => {
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      const fitted = view.now();

      view.wheel();
      const zoomed = view.now();
      expect(zoomed.k).toBeCloseTo(fitted.k * 2 ** 0.2, 6);

      view.size(400, 300);
      view.zoom.setExtent({ x: 0, y: 0, w: 900, h: 300 });
      expectAt(view.now(), zoomed);
    });

    it('takes every wheel over the box, at the zoom limits too, and none once destroyed', () => {
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      // Zoomed out as far as it goes, a wheel out changes nothing; the page still must not scroll.
      for (let i = 0; i < 60; i++) view.wheel(400);
      expect(view.wheel(400)).toBe(true);
      for (let i = 0; i < 60; i++) view.wheel(-400);
      expect(view.wheel(-400)).toBe(true);
      view.zoom.destroy();
      expect(view.wheel(-400)).toBe(false);
    });

    it('keeps fitting after a click or a press that does not move the view', () => {
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);

      view.drag(0, 0);
      view.size(400, 300);
      expectAt(view.now(), fitIn(400, 300));

      // A press held while the view fits by itself: the fit's own moves are not the user's.
      view.press();
      view.size(600, 500);
      view.release();
      view.size(800, 600);
      expectAt(view.now(), fitIn(800, 600));
    });

    it('counts a press as a drag only once it is more than 3 px from where it went down', () => {
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);

      // A click whose pointer jitters by 2 px still leaves the view fitting by itself.
      view.drag(2, 0);
      view.size(400, 300);
      expectAt(view.now(), fitIn(400, 300));

      // A press that jitters, then goes on past 3 px, is a drag.
      view.press();
      window.dispatchEvent(mouse('mousemove', 12, 11));
      window.dispatchEvent(mouse('mousemove', 20, 10));
      view.release(10, 0);
      const dragged = view.now();
      view.size(800, 600);
      expectAt(view.now(), dragged);
    });

    it('still clicks a control in the box after a press that jitters by up to 3 px', async () => {
      // d3-zoom swallows clicks for one task after a drag ends; the last spec's drag has ended.
      await new Promise((done) => setTimeout(done));
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      const button = view.content.appendChild(document.createElement('button'));
      const clicked = vi.fn();
      button.addEventListener('click', clicked);
      const click = (dx: number) => {
        button.dispatchEvent(mouse('mousedown', 10, 10));
        window.dispatchEvent(mouse('mousemove', 10 + dx, 10));
        window.dispatchEvent(mouse('mouseup', 10 + dx, 10));
        button.dispatchEvent(mouse('click', 10 + dx, 10));
      };

      click(3);
      expect(clicked).toHaveBeenCalledTimes(1);
      // d3-zoom swallows the click that ends a drag.
      click(10);
      expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('leaves the view alone after the user drags it', () => {
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      const fitted = view.now();

      view.drag(30, 20);
      expectAt(view.now(), { k: fitted.k, x: fitted.x + 30, y: fitted.y + 20 });

      view.size(400, 300);
      expectAt(view.now(), { k: fitted.k, x: fitted.x + 30, y: fitted.y + 20 });
    });

    it('fits a new level at once and hands the view back, whatever the user did before', () => {
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      view.wheel();

      const level: Rect = { x: 0, y: 0, w: 1200, h: 600 };
      view.zoom.setExtent(level);
      view.zoom.levelChanged();
      expectAt(view.now(), fitIn(800, 600, level));

      view.size(400, 300);
      expectAt(view.now(), fitIn(400, 300, level));
    });
  });

  describe('a bar over the top of the box', () => {
    /** A level much wider than tall, in a short box: centred, its top would sit under the bar. */
    const WIDE: Rect = { x: 0, y: 0, w: 1000, h: 100 };
    const top = () => view.now().y + view.now().k * WIDE.y;

    function bar(height: number) {
      const element = view.box.appendChild(document.createElement('div'));
      Object.defineProperty(element, 'offsetHeight', { configurable: true, value: height });
      return element;
    }

    it('fits the level below the bar, a margin under it', () => {
      view.zoom.setExtent(WIDE);
      view.size(800, 200);
      expect(top()).toBeLessThan(48 + FIT_MARGIN);

      view.zoom.setTopInset(bar(48));

      expect(top()).toBeGreaterThanOrEqual(48 + FIT_MARGIN);
      expect(view.now().k).toBeCloseTo(fitIn(800, 200, WIDE)!.k, 6);
    });

    it('fits again when the bar changes height (its path rewraps) or goes', () => {
      view.zoom.setExtent(WIDE);
      view.size(800, 200);
      const element = bar(48);
      view.zoom.setTopInset(element);

      Object.defineProperty(element, 'offsetHeight', { configurable: true, value: 80 });
      resize(new Map([[element, { w: 300, h: 80 }]]));
      expect(top()).toBeGreaterThanOrEqual(80 + FIT_MARGIN);

      view.zoom.setTopInset(null);
      expectAt(view.now(), fitIn(800, 200, WIDE));
    });
  });

  describe('fit()', () => {
    it('fits again over 250 ms after the user moved the view', () => {
      vi.useFakeTimers({
        toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
      });
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      view.wheel();
      const zoomed = view.now();

      view.zoom.fit();
      expectAt(view.now(), zoomed);
      vi.advanceTimersByTime(125);
      const between = view.now().k;
      expect(between).toBeLessThan(zoomed.k);
      expect(between).toBeGreaterThan(fitIn(800, 600)!.k);
      vi.advanceTimersByTime(150);

      expectAt(view.now(), fitIn(800, 600));
    });

    it('hands the view back, as the demo’s Fit does: a resize fits again', () => {
      stubReducedMotion(true);
      view.teardown();
      view = setup();
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      view.drag(30, 20);

      view.zoom.fit();
      view.size(400, 300);

      expectAt(view.now(), fitIn(400, 300));
    });

    it('stops in flight when the user takes the view', () => {
      vi.useFakeTimers({
        toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
      });
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      view.drag(200, 0);

      view.zoom.fit();
      vi.advanceTimersByTime(100);
      view.drag(10, 0);
      const taken = view.now();
      vi.advanceTimersByTime(300);

      expectAt(view.now(), taken);
      view.size(400, 300);
      expectAt(view.now(), taken);
    });
  });

  describe('keys', () => {
    beforeEach(() => {
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
    });

    it('pans 48 px on screen by the arrow keys, whatever the zoom, the way the key points', () => {
      const start = view.now();
      const panned = (dx: number, dy: number) => ({ k: start.k, x: start.x + dx, y: start.y + dy });

      expect(view.key('ArrowRight').defaultPrevented).toBe(true);
      expectAt(view.now(), panned(-48, 0));
      view.key('ArrowDown');
      expectAt(view.now(), panned(-48, -48));
      view.key('ArrowLeft');
      view.key('ArrowLeft');
      expectAt(view.now(), panned(48, -48));
      view.key('ArrowUp');
      expectAt(view.now(), panned(48, 0));
    });

    it('zooms 1.25× about the box’s centre by + and =, and back by -, over 250 ms', () => {
      vi.useFakeTimers({
        toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
      });
      const start = view.now();
      const centre = start.invert([400, 300]);

      expect(view.key('+').defaultPrevented).toBe(true);
      expect(view.now().k).toBeCloseTo(start.k, 6);
      vi.advanceTimersByTime(300);
      expect(view.now().k).toBeCloseTo(start.k * 1.25, 6);
      expect(view.now().apply(centre)[0]).toBeCloseTo(400, 6);
      expect(view.now().apply(centre)[1]).toBeCloseTo(300, 6);

      view.key('=');
      vi.advanceTimersByTime(300);
      expect(view.now().k).toBeCloseTo(start.k * 1.25 * 1.25, 6);

      view.key('-');
      vi.advanceTimersByTime(300);
      expect(view.now().k).toBeCloseTo(start.k * 1.25, 6);
      expect(view.now().apply(centre)[0]).toBeCloseTo(400, 6);
    });

    it('zooms on from where a zoom in flight is going, so quick presses add up', () => {
      vi.useFakeTimers({
        toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
      });
      const start = view.now();

      view.key('+');
      vi.advanceTimersByTime(100);
      view.key('+');
      vi.advanceTimersByTime(300);

      expect(view.now().k).toBeCloseTo(start.k * 1.25 * 1.25, 6);
    });

    it('fits by 0', () => {
      stubReducedMotion(true);
      view.teardown();
      view = setup();
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      view.drag(100, 50);

      expect(view.key('0').defaultPrevented).toBe(true);

      expectAt(view.now(), fitIn(800, 600));
    });

    it('stops automatic fits once they pan or zoom', () => {
      view.key('ArrowRight');
      const panned = view.now();

      view.size(400, 300);

      expectAt(view.now(), panned);
    });

    /** A part of the drawing at a place on screen (px from the box's corner, which is at 0, 0). */
    function part(left: number, right: number, top: number, bottom: number): HTMLElement {
      const element = view.content.appendChild(document.createElement('button'));
      element.getBoundingClientRect = () =>
        ({
          left,
          right,
          top,
          bottom,
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        }) as DOMRect;
      return element;
    }

    /** Focuses `element` as the keyboard does: Tab, then the focus (jsdom's :focus-visible). */
    function tabTo(element: HTMLElement): void {
      view.key('Tab');
      element.focus();
    }

    it('pans a part the keyboard focuses into view, a margin inside the box', () => {
      const start = view.now();

      tabTo(part(900, 1000, -60, -20));

      // Right: its right edge 24 px inside the box's (800); down: its top 24 px below the box's.
      expectAt(view.now(), { k: start.k, x: start.x - (1000 - 776), y: start.y + (24 + 60) });
      // Panned for the user: the view no longer fits by itself.
      view.size(400, 300);
      expectAt(view.now(), { k: start.k, x: start.x - 224, y: start.y + 84 });
    });

    it('leaves the view alone for a part a press focuses, or one in view', () => {
      const start = view.now();
      const pressed = part(900, 1000, 100, 140);
      pressed.dispatchEvent(mouse('mousedown', 10, 10));
      pressed.focus();
      view.release();
      expectAt(view.now(), start);

      tabTo(part(100, 200, 100, 140));
      expectAt(view.now(), start);
    });

    it('takes a part a fraction of a pixel into the margin (the transform’s rounding) as in view', () => {
      const start = view.now();

      // A fitted level's edge lands at the margin, give or take a fraction of a pixel.
      tabTo(part(23.9999, 120, 23.9999, 60));

      expectAt(view.now(), start);
      // Not moved for the user: the view still fits by itself.
      view.size(400, 300);
      expectAt(view.now(), fitIn(400, 300));
    });

    it('leaves alone other keys, keys with a modifier and keys from inside the box', () => {
      const start = view.now();
      const inside = view.content.appendChild(document.createElement('button'));

      expect(view.key('a').defaultPrevented).toBe(false);
      expect(view.key('+', { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(view.key('0', { metaKey: true }).defaultPrevented).toBe(false);
      expect(view.key('ArrowLeft', { altKey: true }).defaultPrevented).toBe(false);
      expect(view.key('ArrowLeft', {}, inside).defaultPrevented).toBe(false);

      expectAt(view.now(), start);
      // Not having moved, the view still fits by itself.
      view.size(400, 300);
      expectAt(view.now(), fitIn(400, 300));
    });
  });

  describe('limits', () => {
    beforeEach(() => {
      stubReducedMotion(true);
      view.teardown();
      view = setup();
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
    });

    it('keeps the keys’ zoom between 0.2 and 3', () => {
      for (let i = 0; i < 20; i++) view.key('+');
      expect(view.now().k).toBe(3);
      for (let i = 0; i < 40; i++) view.key('-');
      expect(view.now().k).toBe(0.2);
    });

    it('keeps the wheel’s zoom between 0.2 and 3', () => {
      view.wheel(-5000);
      expect(view.now().k).toBe(3);
      view.wheel(5000);
      expect(view.now().k).toBe(0.2);
    });

    it('keeps a fit within them: a tiny level at 3, a huge one at 0.2', () => {
      view.zoom.setExtent({ x: 0, y: 0, w: 10, h: 10 });
      expect(view.now().k).toBe(3);
      view.zoom.setExtent({ x: 0, y: 0, w: 100_000, h: 100_000 });
      expect(view.now().k).toBe(0.2);
    });
  });

  describe('under reduced motion', () => {
    beforeEach(() => {
      stubReducedMotion(true);
      view.teardown();
      view = setup();
      view.zoom.setExtent(EXTENT);
      view.size(800, 600);
      view.drag(100, 50);
    });

    it('jumps to a fit', () => {
      view.zoom.fit();
      expectAt(view.now(), fitIn(800, 600));
    });

    it('jumps by a key’s zoom', () => {
      const start = view.now();
      view.key('+');
      expect(view.now().k).toBeCloseTo(start.k * 1.25, 6);
    });

    it('jumps by a double-click’s zoom, d3-zoom’s own', () => {
      const start = view.now();
      // With Shift it zooms out by half (in, it would pass the upper limit from this fit).
      const init = { bubbles: true, cancelable: true, shiftKey: true };
      view.box.dispatchEvent(new MouseEvent('dblclick', init));
      expect(view.now().k).toBeCloseTo(start.k / 2, 6);
    });
  });

  it('stops d3-zoom’s double-click zoom in flight when destroyed', async () => {
    view.zoom.setExtent(EXTENT);
    view.size(800, 600);
    const start = view.now();
    const dblclick = () =>
      view.box.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, shiftKey: true }));
    const transition = () => new Promise((done) => setTimeout(done, 350));

    // Its own transition, on d3's timer (not the spec's): it zooms out by half over 250 ms ...
    dblclick();
    await transition();
    expect(view.now().k).toBeCloseTo(start.k / 2, 6);

    // ... unless the diagram is destroyed on the way.
    view.zoom.levelChanged();
    dblclick();
    view.zoom.destroy();
    const drawn = view.content.style.transform;
    await transition();
    expectAt(view.now(), start);
    expect(view.content.style.transform).toBe(drawn);
  });

  it('lets go of the box when destroyed: no keys, no observer, no frame in flight', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    view.zoom.setExtent(EXTENT);
    view.size(800, 600);
    view.drag(100, 0);
    view.zoom.fit();
    const before = view.now();

    view.zoom.destroy();
    vi.advanceTimersByTime(300);

    expectAt(view.now(), before);
    expect(view.key('+').defaultPrevented).toBe(false);
    expect(watched()).toEqual([]);
  });
});
