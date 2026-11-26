import { describe, expect, it } from 'vitest';
import {
  COMET_PATH,
  COMET_SEGMENTS,
  COMET_TAIL,
  cometLapMs,
  STEADY_PX_PER_S,
  SteadyComet,
} from './steady-comet';

/** The comet's layer as the box renders it: two drawings of every segment, as rects. */
function fakeLayer(width: number, height: number, radius = 10) {
  const document = globalThis.document;
  const layer = document.createElement('div');
  layer.style.borderTopLeftRadius = `${radius}px`;
  document.body.appendChild(layer);
  for (let copy = 0; copy < 2; copy++) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.append(
      ...COMET_SEGMENTS.map(() => document.createElementNS('http://www.w3.org/2000/svg', 'rect')),
    );
    layer.appendChild(svg);
  }
  let size = { width, height };
  // The layout box, which a transform (a dialog's entrance) does not scale.
  Object.defineProperty(layer, 'offsetWidth', { get: () => size.width });
  Object.defineProperty(layer, 'offsetHeight', { get: () => size.height });
  layer.getBoundingClientRect = () =>
    ({ width: size.width * 0.9, height: size.height * 0.9 }) as DOMRect;
  const animations: {
    keyframes: Keyframe[];
    options: KeyframeAnimationOptions;
    playState: string;
    currentTime: number;
    canceled: boolean;
  }[] = [];
  const animate = (keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = {
      keyframes,
      options,
      playState: 'running',
      currentTime: 0,
      canceled: false,
      play: () => (animation.playState = 'running'),
      pause: () => (animation.playState = 'paused'),
      cancel: () => (animation.canceled = true),
      effect: {
        updateTiming: (timing: EffectTiming) =>
          (animation.options = { ...animation.options, ...timing } as KeyframeAnimationOptions),
      },
    };
    animations.push(animation);
    return animation as unknown as Animation;
  };
  return {
    layer,
    animations,
    withAnimate: () => Object.assign(layer, { animate }),
    rects: () => [...layer.querySelectorAll('rect')],
    resize: (w: number, h: number) => (size = { width: w, height: h }),
  };
}

describe('the steady comet', () => {
  it("laps the edge's length (its rounded corners cut) at one speed in pixels", () => {
    // A 400 × 100 box, its stroke 1 px in: 398 × 98 with corners of 9 px.
    const round = 2 * (398 + 98) - (8 - 2 * Math.PI) * 9;
    expect(cometLapMs(400, 100, 10)).toBeCloseTo((round / STEADY_PX_PER_S) * 1000, 6);
    expect(cometLapMs(0, 100, 10)).toBe(0);
  });

  it('is a tail of abutting dashes along the edge, faint at its end and the head brightest', () => {
    const tail = COMET_TAIL * COMET_PATH;
    const step = tail / COMET_SEGMENTS.length;
    // Each segment's pattern is "0 <before> <dash> <after>": no dash, the gap up to its place in
    // the tail, its dash, and the rest of the edge.
    COMET_SEGMENTS.forEach((segment, i) => {
      const [none, before, dash, after] = segment.dasharray.split(' ').map(Number);
      expect(none).toBe(0);
      expect(before).toBeCloseTo(i * step, 6);
      expect(none + before + dash + after).toBeCloseTo(COMET_PATH, 6);
      // Each dash reaches a little into the next, so no seam shows between them; the head ends
      // the tail.
      if (i < COMET_SEGMENTS.length - 1) expect(dash).toBeGreaterThan(step);
      else expect(before + dash).toBeCloseTo(tail, 6);
    });
    expect(COMET_SEGMENTS[0].stroke).toMatch(/var\(--neat-series-2\).*transparent/);
    expect(COMET_SEGMENTS.at(-1)!.stroke).toMatch(/var\(--neat-glow-head\)/);
    for (const segment of COMET_SEGMENTS) expect(segment.stroke).not.toMatch(/#|rgb|hsl/);
  });

  it("sizes its rects to the box's edge, 1 px in, their corners the box's less 1 px", () => {
    const t = fakeLayer(400, 100, 10);
    new SteadyComet(t.layer);
    for (const rect of t.rects()) {
      expect(rect.getAttribute('x')).toBe('1');
      expect(rect.getAttribute('y')).toBe('1');
      expect(rect.getAttribute('width')).toBe('398');
      expect(rect.getAttribute('height')).toBe('98');
      expect(rect.getAttribute('rx')).toBe('9');
    }
    t.resize(600, 120);
    new SteadyComet(t.layer).resized();
    expect(t.rects()[0].getAttribute('width')).toBe('598');
  });

  it('runs the dashes round the edge in one linear lap while it runs, and pauses', () => {
    const t = fakeLayer(400, 100);
    t.withAnimate();
    const comet = new SteadyComet(t.layer);
    comet.running(true);
    expect(t.animations).toHaveLength(1);
    const [lap] = t.animations;
    expect(lap.keyframes).toEqual([{ strokeDashoffset: 0 }, { strokeDashoffset: -COMET_PATH }]);
    expect(lap.options.duration).toBeCloseTo(cometLapMs(400, 100, 10), 6);
    expect(lap.options.iterations).toBe(Infinity);
    expect(lap.options.easing).toBe('linear');
    comet.running(false);
    expect(lap.playState).toBe('paused');
    comet.running(true);
    expect(t.animations).toHaveLength(1);
    expect(lap.playState).toBe('running');
  });

  it('starts its lap once the box has a size, if it was asked to run before', () => {
    const t = fakeLayer(0, 0);
    t.withAnimate();
    const comet = new SteadyComet(t.layer);
    comet.running(true);
    expect(t.animations).toHaveLength(0);
    t.resize(400, 100);
    comet.resized();
    expect(t.animations).toHaveLength(1);
    expect(t.animations[0].options.duration).toBeCloseTo(cometLapMs(400, 100, 10), 6);
    comet.running(false);
    t.resize(500, 100);
    comet.resized();
    expect(t.animations).toHaveLength(1);
  });

  it('keeps its place along the edge when the box gets another size', () => {
    const t = fakeLayer(400, 100);
    t.withAnimate();
    const comet = new SteadyComet(t.layer);
    comet.running(true);
    const [lap] = t.animations;
    lap.currentTime = cometLapMs(400, 100, 10) / 4;
    t.resize(600, 100);
    comet.resized();
    const next = cometLapMs(600, 100, 10);
    expect(lap.options.duration).toBeCloseTo(next, 6);
    expect(lap.currentTime).toBeCloseTo(next / 4, 6);
    expect(t.rects()[0].getAttribute('width')).toBe('598');
  });

  it('keeps its place along the edge across a moment with no size', () => {
    const t = fakeLayer(400, 100);
    t.withAnimate();
    const comet = new SteadyComet(t.layer);
    comet.running(true);
    const [lap] = t.animations;
    lap.currentTime = cometLapMs(400, 100, 10) / 4;
    t.resize(0, 0);
    comet.resized();
    t.resize(400, 100);
    comet.resized();
    expect(lap.currentTime).toBeCloseTo(cometLapMs(400, 100, 10) / 4, 6);
  });

  it('cancels its lap when destroyed, and stands still without the Web Animations API', () => {
    const t = fakeLayer(400, 100);
    t.withAnimate();
    const comet = new SteadyComet(t.layer);
    comet.running(true);
    comet.destroy();
    expect(t.animations[0].canceled).toBe(true);
    const bare = fakeLayer(400, 100);
    const still = new SteadyComet(bare.layer);
    expect(() => {
      still.running(true);
      still.resized();
      still.destroy();
    }).not.toThrow();
    expect(bare.rects()[0].getAttribute('width')).toBe('398');
  });
});
