import { afterEach, describe, expect, it } from 'vitest';
import { BoxWaveEngine } from './box-wave';
import { boxOf, listeningHost, recordingContext } from './listening.testing';

/** A message box host with its listening canvas, 40 × 30 px: room for ten bars. */
function setup(width = 40) {
  const host = document.createElement('div');
  host.style.setProperty('--neat-series-4', 'teal');
  document.body.append(host);
  host.innerHTML = '<canvas class="listening"></canvas>';
  const canvas = host.querySelector('canvas')!;
  boxOf(canvas, width, 30);
  const context = recordingContext(canvas);
  const t = listeningHost(host);
  const engine = new BoxWaveEngine(t.deps);
  /** The bars of the last frame, as [x, y, width, height]. */
  const bars = () => {
    const all = context.named('fillRect').map((call) => call.args as number[]);
    context.clear();
    return all;
  };
  return { ...t, engine, canvas, context, bars };
}

describe('BoxWaveEngine', () => {
  afterEach(() => document.body.replaceChildren());

  it('draws the newest levels from the right, one bar every 4 px', () => {
    const t = setup();
    t.engine.recording(true);
    t.setLevel(0.5);
    t.clock.frame();
    let bars = t.bars();
    expect(bars).toEqual([[36, (30 - 15) / 2, 2.4, 15]]);
    t.setLevel(1);
    t.clock.frame();
    bars = t.bars();
    expect(bars).toEqual([
      [32, 7.5, 2.4, 15],
      [36, 1, 2.4, 28],
    ]);
    for (let i = 0; i < 19; i++) t.clock.frame();
    t.bars();
    t.clock.frame();
    bars = t.bars();
    expect(bars).toHaveLength(10);
    expect(bars[0][0]).toBe(0);
    expect(bars[9][0]).toBe(36);
    expect(t.context.calls.length).toBe(0);
    t.engine.destroy();
  });

  it('scrolls by time, not by frame: a 120 Hz screen adds a bar every other frame', () => {
    const t = setup();
    t.engine.recording(true);
    t.setLevel(0.5);
    for (let i = 0; i < 12; i++) t.clock.frame(1000 / 120);
    t.context.clear();
    t.clock.frame(1000 / 120);
    expect(t.bars()).toHaveLength(7);
    t.engine.destroy();
  });

  it('collapses on release and holds while transcribing', () => {
    const t = setup();
    t.engine.recording(true);
    t.setLevel(1);
    t.clock.frame();
    t.engine.recording(false);
    t.setLevel(null);
    t.bars();
    t.clock.frame(175);
    const half = t.bars();
    expect(half[0][3]).toBeGreaterThan(2);
    expect(half[0][3]).toBeLessThan(30);
    t.clock.frame(200);
    const collapsed = t.bars();
    expect(collapsed.every((bar) => bar[3] === 2)).toBe(true);
    expect(t.stops()).toBe(1);
    expect(t.clock.pending()).toBe(false);
    // What it drew stays: nothing clears the canvas until the engine goes.
    expect(t.context.named('clearRect')).toHaveLength(0);
    t.engine.destroy();
  });

  it('runs no frames while hidden', () => {
    const t = setup();
    t.engine.recording(true);
    t.document.setHidden(true);
    t.clock.frame();
    expect(t.clock.pending()).toBe(false);
    expect(t.bars()).toEqual([]);
    t.document.setHidden(false);
    expect(t.clock.pending()).toBe(true);
    t.engine.destroy();
  });

  it('allocates nothing per frame', () => {
    const t = setup();
    t.engine.recording(true);
    const levels = t.engine['levels'];
    for (let i = 0; i < 100; i++) {
      t.setLevel(i / 100);
      t.clock.frame();
    }
    expect(t.engine['levels']).toBe(levels);
    t.engine.destroy();
  });
});
