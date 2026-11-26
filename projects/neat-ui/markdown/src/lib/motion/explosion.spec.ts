import { ExplosionEngine } from './explosion';
import { motionHost, pieceElement } from './motion.testing';

/** A 2D context that records the particles drawn: where, in which color, how opaque. */
function recordingContext() {
  const drawn: { x: number; y: number; color: string; alpha: number }[] = [];
  const context = {
    fillStyle: '' as string,
    globalAlpha: 1,
    setTransform: () => undefined,
    clearRect: () => drawn.splice(0),
    fillRect(x: number, y: number) {
      drawn.push({ x, y, color: context.fillStyle, alpha: context.globalAlpha });
    },
  };
  return { context, drawn };
}

/** Rects as a piece's lines give them, relative to a host at the page's origin. */
const rects = (...boxes: { left: number; top: number; width: number; height?: number }[]) =>
  boxes.map(
    ({ left, top, width, height = 20 }) =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect,
  );

function explosionHost(options: { height?: number; random?: () => number } = {}) {
  const host = document.createElement('div');
  const height = options.height ?? 1000;
  host.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 600, height, right: 600, bottom: height }) as DOMRect;
  const paragraph = document.createElement('p');
  const canvas = document.createElement('canvas');
  canvas.className = 'particles';
  const { context, drawn } = recordingContext();
  canvas.getContext = (() => context) as unknown as HTMLCanvasElement['getContext'];
  host.append(paragraph, canvas);
  document.body.append(host);
  const parts = motionHost(host);
  const deps = options.random ? { ...parts.deps, random: options.random } : parts.deps;
  const colors = { '--neat-series-1': 'blue', '--neat-series-2': 'purple', '--primary': 'orange' };
  const setColors = (values: Record<string, string>) => Object.assign(colors, values);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    () =>
      ({
        getPropertyValue: (name: string) =>
          (colors as Record<string, string>)[name] ?? `${name}-color`,
      }) as CSSStyleDeclaration,
  );
  const engine = new ExplosionEngine(deps);
  let index = 0;
  let epoch = 0;
  return {
    ...parts,
    host,
    canvas,
    drawn,
    engine,
    setColors,
    /** Renders a new piece whose lines are `boxes`. */
    add(...boxes: { left: number; top: number; width: number; height?: number }[]) {
      const piece = pieceElement(document, { index, from: index * 5, text: 'piece' });
      index++;
      piece.getClientRects = () => rects(...boxes) as unknown as DOMRectList;
      paragraph.append(piece);
      engine.rendered(true, epoch);
    },
    /** Renders the text written anew: no pieces, their count starting again. */
    rewrite() {
      paragraph.replaceChildren();
      index = 0;
      engine.rendered(true, ++epoch);
    },
  };
}

describe('ExplosionEngine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('spawns min(60, width × 1.3) particles per rect of a new piece', () => {
    const reply = explosionHost();
    reply.add({ left: 0, top: 0, width: 20 }, { left: 0, top: 20, width: 100 });
    reply.clock.frame();
    expect(reply.drawn).toHaveLength(26 + 60);
    // The piece seen again spawns nothing more.
    reply.engine.rendered(true, 0);
    reply.clock.frame();
    expect(reply.drawn).toHaveLength(86);
  });

  it('draws each particle along its eased path and drops it after its fade', () => {
    // Every random is a half: the end at the rect's middle, the start 75 px away at 180°.
    const reply = explosionHost({ random: () => 0.5 });
    reply.add({ left: 100, top: 400, width: 1 });
    const ex = 100.5;
    const ey = 400 + 20 * 0.55;
    // t0 is 30 ms on, the condensing 380 ms: halfway at 220 ms.
    reply.clock.frame(220);
    const [particle] = reply.drawn;
    const eased = 1 - 0.5 ** 3;
    expect(particle.x + 1).toBeCloseTo(ex - 75 + 75 * eased);
    // Drawn in the band, whose top is the line's middle less 200.
    expect(particle.y + 1).toBeCloseTo(ey - (410 - 200), 3);
    expect(particle.alpha).toBeCloseTo(0.35 + 0.65 * 0.5);
    expect(particle.color).toBe('orange');
    reply.clock.frame(190 + 110);
    expect(reply.drawn[0].alpha).toBeCloseTo(0.5);
    reply.clock.frame(120);
    expect(reply.drawn).toHaveLength(0);
    expect(reply.clock.pending()).toBe(false);
  });

  it('keeps at most 4096 particles, the oldest overwritten', () => {
    const reply = explosionHost();
    for (let i = 0; i < 70; i++) reply.add({ left: 0, top: 0, width: 100 });
    reply.clock.frame();
    expect(reply.drawn).toHaveLength(4096);
  });

  it('the band follows the newest line and stays inside the host', () => {
    const reply = explosionHost({ height: 1000 });
    reply.add({ left: 0, top: 500, width: 10 });
    expect(reply.canvas.style.transform).toBe('translateY(310px)');
    reply.add({ left: 0, top: 960, width: 10 });
    expect(reply.canvas.style.transform).toBe('translateY(600px)');
    reply.add({ left: 0, top: 10, width: 10 });
    expect(reply.canvas.style.transform).toBe('translateY(0px)');
    const short = explosionHost({ height: 120 });
    short.add({ left: 0, top: 60, width: 10 });
    expect(short.canvas.style.transform).toBe('translateY(0px)');
  });

  it("takes the theme's colors per piece, so a scheme change reaches the next piece", () => {
    const reply = explosionHost({ random: () => 0.5 });
    reply.add({ left: 0, top: 0, width: 1 });
    reply.setColors({ '--primary': 'light-orange' });
    reply.add({ left: 0, top: 0, width: 1 });
    reply.clock.frame();
    expect(reply.drawn.map((particle) => particle.color)).toEqual(['orange', 'light-orange']);
  });

  it('runs no frames while hidden, and text that came meanwhile spawns nothing', () => {
    const reply = explosionHost();
    reply.document.setHidden(true);
    reply.add({ left: 0, top: 0, width: 50 });
    expect(reply.clock.requested).toBe(0);
    reply.document.setHidden(false);
    // Rendered as the page comes back: what came meanwhile is simply there.
    reply.add({ left: 0, top: 0, width: 50 });
    reply.clock.frame();
    expect(reply.drawn).toHaveLength(0);
    reply.clock.frame(200);
    reply.add({ left: 0, top: 0, width: 50 });
    reply.clock.frame();
    expect(reply.drawn).toHaveLength(60);
  });

  it('runs no frames once no particle is left', () => {
    const reply = explosionHost();
    reply.add({ left: 0, top: 0, width: 10 });
    let frames = 0;
    while (reply.clock.pending() && frames < 100) {
      reply.clock.frame();
      frames++;
    }
    expect(reply.clock.pending()).toBe(false);
    // 60 ms of jitter, 460 ms at most to condense, 220 ms to fade: under 50 frames of 16 ms.
    expect(frames).toBeLessThan(50);
    expect(reply.engine.moving()).toBe(false);
    expect(reply.stops()).toBe(1);
  });

  it('a text written anew drops the particles still on their way', () => {
    const reply = explosionHost();
    reply.add({ left: 0, top: 0, width: 40 });
    reply.clock.frame();
    expect(reply.drawn.length).toBeGreaterThan(0);
    reply.rewrite();
    expect(reply.drawn).toHaveLength(0);
    expect(reply.engine.moving()).toBe(false);
    reply.clock.frame();
    expect(reply.drawn).toHaveLength(0);
    expect(reply.clock.pending()).toBe(false);
    // The new text's first piece spawns its own.
    reply.add({ left: 0, top: 0, width: 10 });
    reply.clock.frame(100);
    expect(reply.drawn).toHaveLength(13);
  });

  it('stops its frames and listeners when destroyed', () => {
    const reply = explosionHost();
    reply.add({ left: 0, top: 0, width: 10 });
    reply.engine.destroy();
    expect(reply.clock.pending()).toBe(false);
    expect(reply.document.listeners.size).toBe(0);
  });
});
