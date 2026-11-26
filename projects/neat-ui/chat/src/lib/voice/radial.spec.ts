import { afterEach, describe, expect, it, vi } from 'vitest';
import { boxOf, listeningHost, recordingContext } from './listening.testing';
import { RadialEngine } from './radial';

/** A push-to-talk host with its radial canvas, 150 px wide: a button of radius 29 inside. */
function setup() {
  const host = document.createElement('div');
  host.style.setProperty('--neat-series-1', 'blue');
  host.style.setProperty('--neat-series-4', 'teal');
  document.body.append(host);
  host.innerHTML = '<canvas class="radial"></canvas>';
  const canvas = host.querySelector('canvas')!;
  boxOf(canvas, 150, 150);
  const context = recordingContext(canvas);
  const t = listeningHost(host);
  const engine = new RadialEngine(t.deps);
  return { ...t, engine, canvas, context };
}

/** Each bar's end as drawn in the last frame: [x, y] of its lineTo. */
function ends(context: ReturnType<typeof recordingContext>): number[][] {
  return context.named('lineTo').map((call) => call.args as number[]);
}

describe('RadialEngine', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('draws 56 bars around the button from the smoothed level', () => {
    const t = setup();
    t.setLevel(1);
    t.engine.recording(true);
    t.context.clear();
    t.clock.frame(16);
    expect(t.context.named('moveTo')).toHaveLength(56);
    expect(t.context.named('lineTo')).toHaveLength(56);
    expect(t.context.named('stroke')).toHaveLength(2);
    // Smoothed by time: 0.55 kept each 1/60 s, so a 16 ms frame keeps k = 0.55^(16 / 16.67).
    const k = 0.55 ** (16 / (1000 / 60));
    // The first bar points up from r0 = 33: v = (1 − k) × (0.5 + 0.5 × |sin(0.016 × 9)|).
    const v = (1 - k) * (0.5 + 0.5 * Math.abs(Math.sin(0.016 * 9)));
    expect(t.context.named('moveTo')[0].args[1]).toBeCloseTo(-33, 3);
    expect(ends(t.context)[0][1]).toBeCloseTo(-(33 + 3 + v * 34), 3);
    // The next frame smooths it: v × k + (1 − k) × the new target.
    t.context.clear();
    t.clock.frame(16);
    const next = v * k + (1 - k) * (0.5 + 0.5 * Math.abs(Math.sin(0.032 * 9)));
    expect(ends(t.context)[0][1]).toBeCloseTo(-(33 + 3 + next * 34), 3);
    expect(t.canvas.width).toBe(150 * devicePixelRatio);
    t.engine.destroy();
  });

  it('smooths by time, not by frame: a 120 Hz screen reaches what a 60 Hz one does', () => {
    // The first bar's end after 1/60 s at full level; the ripple moves a little between frames.
    const at = (rate: number) => {
      const t = setup();
      t.setLevel(1);
      t.engine.recording(true);
      for (let i = 0; i < rate / 60; i++) {
        t.context.clear();
        t.clock.frame(1000 / rate);
      }
      const end = ends(t.context)[0][1];
      t.engine.destroy();
      document.body.replaceChildren();
      return end;
    };
    expect(Math.abs(at(120) - at(60))).toBeLessThan(0.5);
  });

  it('folds in over 350 ms on release, then stops', () => {
    const t = setup();
    t.setLevel(1);
    t.engine.recording(true);
    t.clock.frame(16);
    t.engine.recording(false);
    t.context.clear();
    t.clock.frame(175);
    const half = ends(t.context)[0][1];
    t.context.clear();
    t.clock.frame(175);
    expect(ends(t.context)[0][1]).toBeCloseTo(-36, 3);
    expect(half).toBeLessThan(-36);
    expect(t.stops()).toBe(1);
    expect(t.clock.pending()).toBe(false);
    t.engine.destroy();
  });

  it('reads its two colors once per recording', () => {
    const t = setup();
    const read = vi.spyOn(window, 'getComputedStyle');
    t.engine.recording(true);
    for (let i = 0; i < 5; i++) t.clock.frame(16);
    expect(read).toHaveBeenCalledTimes(1);
    const colors = t.context.named('=strokeStyle').map((call) => call.args[0]);
    expect(new Set(colors)).toEqual(new Set(['teal', 'blue']));
    t.engine.recording(false);
    t.engine.recording(true);
    t.clock.frame(16);
    expect(read).toHaveBeenCalledTimes(2);
    t.engine.destroy();
  });

  it('runs no frames while hidden', () => {
    const t = setup();
    t.engine.recording(true);
    t.document.setHidden(true);
    t.clock.frame(16);
    expect(t.clock.pending()).toBe(false);
    t.document.setHidden(false);
    expect(t.clock.pending()).toBe(true);
    t.engine.destroy();
  });
});
