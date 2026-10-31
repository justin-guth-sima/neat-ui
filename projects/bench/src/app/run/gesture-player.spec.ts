import { type DiagramTransform, ZOOM_LIMITS } from '@bench/diagram-seam';
// The only d3 in the bench: these specs hold the pure reducers to the library they stand in for.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { select } from 'd3-selection';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import {
  type Box,
  domGestures,
  type GestureTarget,
  GesturePlayer,
  panned,
  reducerGestures,
  zoomedAbout,
} from './gesture-player';

const BOX: Box = { left: 100, top: 50, width: 1920, height: 1080 };
const START: DiagramTransform = { k: 0.8, x: 60, y: 40 };
const FREE_SPOT = { x: 300, y: 200 };

/**
 * Lets an event carry `view: window`, which a real browser accepts and jsdom does not: the test
 * environment's `window` is the global object, not a jsdom Window, so its event constructors
 * refuse it as `view`. The stand-ins set the property after construction.
 */
function allowEventView(): void {
  const withView = (Base: typeof MouseEvent): typeof MouseEvent => {
    function Viewed(type: string, init: MouseEventInit = {}): MouseEvent {
      const { view, ...rest } = init;
      const event = new Base(type, rest);
      Object.defineProperty(event, 'view', { value: view });
      return event;
    }
    return Viewed as unknown as typeof MouseEvent;
  };
  vi.stubGlobal('MouseEvent', withView(MouseEvent));
  vi.stubGlobal('WheelEvent', withView(WheelEvent as unknown as typeof MouseEvent));
}

beforeEach(allowEventView);
afterEach(() => vi.unstubAllGlobals());

type Call = [name: 'press' | 'drag' | 'release' | 'wheel', ...args: number[]];

/** A target that keeps what it was asked to do, with the transform the wheel would leave. */
function recording(start: DiagramTransform = START) {
  const calls: Call[] = [];
  let at = start;
  const target: GestureTarget = {
    rect: () => BOX,
    transform: () => at,
    press: (x, y) => calls.push(['press', x, y]),
    drag: (x, y) => calls.push(['drag', x, y]),
    release: (x, y) => calls.push(['release', x, y]),
    wheel: (x, y, deltaY) => {
      calls.push(['wheel', x, y, deltaY]);
      at = zoomedAbout(at, { x: x - BOX.left, y: y - BOX.top }, deltaY);
    },
  };
  return { target, calls, transform: () => at };
}

/** Plays `ms` of a phase at `frameMs` per frame from time `t0`, and ends it as the driver does. */
function play(player: GesturePlayer, phase: string, ms: number, frameMs = 1000 / 60, t0 = 5000) {
  player.begin(phase, t0, ms);
  let t = t0;
  while (t + frameMs < t0 + ms) player.frame((t += frameMs));
  player.end();
}

describe('panned', () => {
  it('adds the pointer’s movement and keeps the scale', () => {
    expect(panned({ k: 2, x: 10, y: 20 }, 5, -7)).toEqual({ k: 2, x: 15, y: 13 });
  });
});

describe('zoomedAbout', () => {
  it('scales by 2^(-deltaY × 0.002) and keeps the diagram point under the cursor still', () => {
    const t: DiagramTransform = { k: 0.5, x: 30, y: -20 };
    const at = { x: 400, y: 300 };
    const next = zoomedAbout(t, at, -500);

    expect(next.k).toBeCloseTo(1, 12);
    // The point under the cursor before, in diagram units, is under it after.
    expect((at.x - next.x) / next.k).toBeCloseTo((at.x - t.x) / t.k, 9);
    expect((at.y - next.y) / next.k).toBeCloseTo((at.y - t.y) / t.k, 9);
  });

  it('holds the scale within the zoom limits', () => {
    const [min, max] = ZOOM_LIMITS;
    expect(zoomedAbout({ k: 2.9, x: 0, y: 0 }, { x: 0, y: 0 }, -5000).k).toBe(max);
    expect(zoomedAbout({ k: 0.25, x: 0, y: 0 }, { x: 0, y: 0 }, 5000).k).toBe(min);
  });

  it('is what d3-zoom does with the same wheel event', () => {
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(BOX.left, BOX.top));
    const behavior = zoom<HTMLDivElement, unknown>().scaleExtent([ZOOM_LIMITS[0], ZOOM_LIMITS[1]]);
    const selection = select(element).call(behavior);
    behavior.transform(selection, zoomIdentity.translate(START.x, START.y).scale(START.k));
    vi.useFakeTimers();
    try {
      let reduced: DiagramTransform = START;
      for (const deltaY of [-300, -120, 80, 250, -40]) {
        const at = { x: 700, y: 400 };
        element.dispatchEvent(
          new WheelEvent('wheel', { clientX: BOX.left + at.x, clientY: BOX.top + at.y, deltaY }),
        );
        reduced = zoomedAbout(reduced, at, deltaY);
        const d3 = zoomTransform(element);
        expect(d3.k).toBeCloseTo(reduced.k, 9);
        expect(d3.x).toBeCloseTo(reduced.x, 6);
        expect(d3.y).toBeCloseTo(reduced.y, 6);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('GesturePlayer', () => {
  it('does nothing in the idle phase', () => {
    const { target, calls } = recording();
    play(new GesturePlayer(target, FREE_SPOT), 'idle', 3000);
    expect(calls).toEqual([]);
  });

  it('refuses a phase it does not know, so a renamed phase does not play nothing', () => {
    const player = new GesturePlayer(recording().target, FREE_SPOT);
    expect(() => player.begin('swirl', 0, 1000)).toThrow(/swirl/);
  });

  it('refuses a second phase before the first has ended', () => {
    const player = new GesturePlayer(recording().target, FREE_SPOT);
    player.begin('pan', 0, 3000);
    expect(() => player.begin('zoom', 10, 2000)).toThrow(/pan/);
  });

  describe('pan', () => {
    it('presses at the empty spot, where a node cannot take the press', () => {
      const { target, calls } = recording();
      play(new GesturePlayer(target, FREE_SPOT), 'pan', 3000);

      expect(calls[0]).toEqual([
        'press',
        BOX.left + START.x + FREE_SPOT.x * START.k,
        BOX.top + START.y + FREE_SPOT.y * START.k,
      ]);
    });

    it('presses inside the box when the empty spot is drawn outside it', () => {
      const { target, calls } = recording({ k: 0.8, x: -5000, y: 9000 });
      play(new GesturePlayer(target, FREE_SPOT), 'pan', 3000);

      const [, x, y] = calls[0];
      expect(x).toBeGreaterThanOrEqual(BOX.left);
      expect(x).toBeLessThanOrEqual(BOX.left + BOX.width);
      expect(y).toBeGreaterThanOrEqual(BOX.top);
      expect(y).toBeLessThanOrEqual(BOX.top + BOX.height);
    });

    it('drags along a Lissajous path of ±40 % of the box, a function of time', () => {
      const { target, calls } = recording();
      const player = new GesturePlayer(target, FREE_SPOT);
      player.begin('pan', 1000, 3000);
      const [, x0, y0] = calls[0];

      player.frame(1750); // a quarter of the way: the x swing at its peak, y back at the start
      player.frame(2500); // halfway: x back, y at the start after one full swing
      const [, qx, qy] = calls[1];
      const [, hx, hy] = calls[2];
      expect(qx - x0).toBeCloseTo(0.4 * BOX.width, 6);
      expect(qy - y0).toBeCloseTo(0, 6);
      expect(hx - x0).toBeCloseTo(0, 6);
      expect(hy - y0).toBeCloseTo(0, 6);
    });

    it('gives a slow machine fewer events along the same path, not a shorter one', () => {
      const fast = recording();
      const slow = recording();
      play(new GesturePlayer(fast.target, FREE_SPOT), 'pan', 3000, 1000 / 60);
      play(new GesturePlayer(slow.target, FREE_SPOT), 'pan', 3000, 1000 / 8);

      const drags = (calls: Call[]) => calls.filter(([name]) => name === 'drag');
      expect(drags(slow.calls).length).toBeLessThan(drags(fast.calls).length / 4);
      // Both end where they began and both released once.
      for (const { calls } of [fast, slow]) {
        const last = calls[calls.length - 1];
        expect(last).toEqual(['release', calls[0][1], calls[0][2]]);
        expect(calls.filter(([name]) => name === 'release')).toHaveLength(1);
      }
    });

    it('stretches over a long frame: the position follows the clock, not the frame count', () => {
      const { target, calls } = recording();
      const player = new GesturePlayer(target, FREE_SPOT);
      player.begin('pan', 0, 3000);
      player.frame(750);
      player.frame(2250); // a 1.5 s frame jumps to three quarters of the path, the swing's low
      const [, x0] = calls[0];
      expect(calls[1][1]).toBeCloseTo(x0 + 0.4 * BOX.width, 6);
      expect(calls[2][1]).toBeCloseTo(x0 - 0.4 * BOX.width, 6);
    });
  });

  describe('zoom', () => {
    it('wheels in to 2.5× the start about the box’s centre, then out to the start', () => {
      const { target, calls, transform } = recording();
      const player = new GesturePlayer(target, FREE_SPOT);
      player.begin('zoom', 0, 2000);
      let peak = 0;
      for (let t = 16; t < 2000; t += 16) {
        player.frame(t);
        peak = Math.max(peak, transform().k);
      }
      player.end();

      expect(peak).toBeGreaterThan(START.k * 2.45);
      expect(peak).toBeLessThanOrEqual(START.k * 2.5 + 1e-9);
      expect(transform().k).toBeCloseTo(START.k, 9);
      expect(transform().x).toBeCloseTo(START.x, 6);
      expect(transform().y).toBeCloseTo(START.y, 6);
      for (const [, x, y] of calls) {
        expect(x).toBe(BOX.left + BOX.width / 2);
        expect(y).toBe(BOX.top + BOX.height / 2);
      }
    });

    it('stops at the zoom limit when 2.5× would pass it', () => {
      const { target, transform } = recording({ k: 2, x: 0, y: 0 });
      const player = new GesturePlayer(target, FREE_SPOT);
      player.begin('zoom', 0, 2000);
      let peak = 0;
      for (let t = 16; t < 1000; t += 16) {
        player.frame(t);
        peak = Math.max(peak, transform().k);
      }
      expect(peak).toBeLessThanOrEqual(ZOOM_LIMITS[1]);
      expect(peak).toBeGreaterThan(2.9);
    });
  });

  describe('the zoom box', () => {
    it('is measured once per gesture, at its begin, and handed to each wheel event', () => {
      const { target, calls } = recording();
      const rect = vi.spyOn(target, 'rect');
      const wheel = vi.spyOn(target, 'wheel');
      const player = new GesturePlayer(target, FREE_SPOT);
      play(player, 'zoom', 2000);

      expect(calls.filter(([name]) => name === 'wheel').length).toBeGreaterThan(10);
      // Reading a box's rect per event is layout work the floor must not pay for.
      expect(rect).toHaveBeenCalledTimes(1);
      for (const call of wheel.mock.calls) expect(call[3]).toBe(BOX);
    });
  });

  describe('zoomed-out', () => {
    it('wheels out to the zoom limit and stays there', () => {
      const { target, transform } = recording();
      const player = new GesturePlayer(target, FREE_SPOT);
      player.begin('zoomed-out', 0, 2000);
      const seen: number[] = [];
      for (let t = 16; t < 2000; t += 16) {
        player.frame(t);
        seen.push(transform().k);
      }
      player.end();

      expect(seen[seen.length - 1]).toBe(ZOOM_LIMITS[0]);
      expect(transform().k).toBe(ZOOM_LIMITS[0]);
      // At the limit by the end of the first half, and not before it starts.
      expect(seen[0]).toBeGreaterThan(ZOOM_LIMITS[0]);
      expect(seen[Math.floor(seen.length / 2)]).toBe(ZOOM_LIMITS[0]);
    });

    it('does not wheel when the fit is already at the limit', () => {
      const { target, calls } = recording({ k: ZOOM_LIMITS[0], x: 0, y: 0 });
      play(new GesturePlayer(target, FREE_SPOT), 'zoomed-out', 2000);
      expect(calls).toEqual([]);
    });
  });
});

describe('the two kinds of target', () => {
  const frames = (phase: string, ms: number) => {
    const times: number[] = [];
    for (let t = 16; t < ms; t += 16) times.push(t);
    return { phase, ms, times };
  };

  it('reducerGestures write each new transform through the setter', () => {
    let at = START;
    const written: DiagramTransform[] = [];
    const target = reducerGestures(
      () => BOX,
      () => at,
      (t) => written.push((at = t)),
    );
    target.press(500, 400);
    target.drag(530, 390);
    target.release(530, 390);
    target.wheel(BOX.left + 10, BOX.top + 20, -100, BOX);

    expect(written[0]).toEqual({ k: START.k, x: START.x + 30, y: START.y - 10 });
    expect(written).toHaveLength(2);
    expect(written[1].k).toBeCloseTo(START.k * 2 ** 0.2, 12);
  });

  it('reducerGestures turn a wheel with the box they are given, and never measure one', () => {
    const rect = vi.fn(() => BOX);
    let at = START;
    const target = reducerGestures(
      rect,
      () => at,
      (t) => (at = t),
    );
    const moved = { left: 400, top: 300, width: 800, height: 600 };
    target.wheel(moved.left + 10, moved.top + 20, -100, moved);

    expect(rect).not.toHaveBeenCalled();
    // The cursor is 10 and 20 px into the box it was given, not into `BOX`.
    expect(at).toEqual(zoomedAbout(START, { x: 10, y: 20 }, -100));
  });

  it('ignore a drag with no press, as a pointer that is not down moves nothing', () => {
    const written: DiagramTransform[] = [];
    const target = reducerGestures(
      () => BOX,
      () => START,
      (t) => written.push(t),
    );
    target.drag(10, 10);
    expect(written).toEqual([]);
  });

  it.each(['pan', 'zoom', 'zoomed-out'])(
    'move the same way as d3-zoom does on %s, the reducer being d3-zoom’s',
    (phase) => {
      const element = document.createElement('div');
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(BOX.left, BOX.top, BOX.width, BOX.height),
      );
      const behavior = zoom<HTMLDivElement, unknown>().scaleExtent([
        ZOOM_LIMITS[0],
        ZOOM_LIMITS[1],
      ]);
      const selection = select(element).call(behavior);
      behavior.transform(selection, zoomIdentity.translate(START.x, START.y).scale(START.k));

      let reduced = START;
      const dom = domGestures(element, () => {
        const { k, x, y } = zoomTransform(element);
        return { k, x, y };
      });
      const pure = reducerGestures(
        () => BOX,
        () => reduced,
        (t) => (reduced = t),
      );

      vi.useFakeTimers();
      try {
        const { ms, times } = frames(phase, 2000);
        const a = new GesturePlayer({ ...dom, rect: () => BOX }, FREE_SPOT);
        const b = new GesturePlayer(pure, FREE_SPOT);
        a.begin(phase, 0, ms);
        b.begin(phase, 0, ms);
        for (const t of times) {
          a.frame(t);
          b.frame(t);
          const d3 = zoomTransform(element);
          expect(d3.k).toBeCloseTo(reduced.k, 9);
          expect(d3.x).toBeCloseTo(reduced.x, 5);
          expect(d3.y).toBeCloseTo(reduced.y, 5);
        }
        a.end();
        b.end();
        expect(zoomTransform(element).k).toBeCloseTo(reduced.k, 9);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('domGestures dispatch the press on the box and the moves on the window', () => {
    const element = document.createElement('div');
    const onBox: string[] = [];
    const onWindow: string[] = [];
    for (const type of ['mousedown', 'wheel']) {
      element.addEventListener(type, (event) => onBox.push(event.type));
    }
    const seen = (event: Event) => {
      onWindow.push(`${event.type}:${(event as MouseEvent).view === window}`);
    };
    window.addEventListener('mousemove', seen);
    window.addEventListener('mouseup', seen);
    try {
      const target = domGestures(element, () => ({ k: 1, x: 0, y: 0 }));
      target.press(10, 20);
      target.drag(11, 21);
      target.release(11, 21);
      target.wheel(5, 5, -10, { left: 0, top: 0, width: 10, height: 10 });
    } finally {
      window.removeEventListener('mousemove', seen);
      window.removeEventListener('mouseup', seen);
    }
    expect(onBox).toEqual(['mousedown', 'wheel']);
    // d3-zoom subscribes to `event.view`, so the events must carry the window.
    expect(onWindow).toEqual(['mousemove:true', 'mouseup:true']);
  });
});
