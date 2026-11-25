import { describe, expect, it } from 'vitest';
import { listeningHost } from './listening.testing';
import { RingWaveEngine } from './ring-wave';

/** A push-to-talk host as the template renders it for the ring and the waveform. */
function setup() {
  const host = document.createElement('div');
  host.innerHTML =
    '<span class="ring"></span><span class="wave">' + '<i></i>'.repeat(28) + '</span>';
  const t = listeningHost(host);
  const engine = new RingWaveEngine(t.deps);
  const ring = host.querySelector<HTMLElement>('.ring')!;
  const wave = host.querySelector<HTMLElement>('.wave')!;
  const bars = [...wave.querySelectorAll<HTMLElement>('i')];
  const scaleOf = (bar: HTMLElement) => Number(/scaleY\(([^)]+)\)/.exec(bar.style.transform)![1]);
  return { ...t, engine, ring, wave, bars, scaleOf };
}

describe('RingWaveEngine', () => {
  it('the ring scales with the level and fades as it grows', () => {
    const t = setup();
    t.setLevel(1);
    t.engine.recording(true);
    t.clock.frame();
    expect(t.ring.style.transform).toBe('scale(1.45)');
    expect(Number(t.ring.style.opacity)).toBeCloseTo(0.15, 5);
    t.setLevel(0);
    t.clock.frame();
    expect(t.ring.style.transform).toBe('scale(1)');
    expect(Number(t.ring.style.opacity)).toBeCloseTo(0.6, 5);
    t.engine.destroy();
  });

  it('the waveform takes a level every 50 ms and scrolls', () => {
    const t = setup();
    t.setLevel(0.5);
    t.engine.recording(true);
    t.clock.frame(16);
    expect(t.scaleOf(t.bars[27])).toBeCloseTo(28 / 53, 3);
    expect(t.scaleOf(t.bars[26])).toBeCloseTo(5.5 / 53, 3);
    t.setLevel(1);
    t.clock.frame(16);
    t.clock.frame(16);
    expect(t.scaleOf(t.bars[27])).toBeCloseTo(28 / 53, 3);
    t.clock.frame(16);
    expect(t.scaleOf(t.bars[27])).toBeCloseTo(1, 5);
    expect(t.scaleOf(t.bars[26])).toBeCloseTo(28 / 53, 3);
    expect(t.scaleOf(t.bars[0])).toBeCloseTo(5.5 / 53, 3);
    t.engine.destroy();
  });

  it('writes the bars only when a level enters, not every frame', () => {
    const t = setup();
    let writes = 0;
    const bar = t.bars[27];
    let value = '';
    Object.defineProperty(bar.style, 'transform', {
      get: () => value,
      set: (next: string) => {
        writes++;
        value = next;
      },
    });
    t.setLevel(0.5);
    t.engine.recording(true);
    for (let i = 0; i < 6; i++) t.clock.frame(16); // 96 ms: levels at 16 and 64 ms
    expect(writes).toBe(2);
    t.engine.destroy();
  });

  it('release collapses the bars and stops the frames once collapsed', () => {
    const t = setup();
    t.setLevel(0.8);
    t.engine.recording(true);
    t.clock.frame();
    t.engine.recording(false);
    expect(t.wave.hasAttribute('data-collapsed')).toBe(true);
    expect(t.bars.every((bar) => bar.style.transform === '')).toBe(true);
    expect(t.ring.style.transform).toBe('scale(1)');
    expect(t.engine.moving()).toBe(true);
    t.clock.frame(200);
    expect(t.stops()).toBe(0);
    expect(t.bars.every((bar) => bar.style.transform === '')).toBe(true);
    t.clock.frame(200);
    expect(t.stops()).toBe(1);
    expect(t.engine.moving()).toBe(false);
    expect(t.clock.pending()).toBe(false);
    t.engine.destroy();
  });

  it('runs no frames while hidden and shows the current level back in view', () => {
    const t = setup();
    t.setLevel(0.2);
    t.engine.recording(true);
    t.clock.frame();
    t.document.setHidden(true);
    t.clock.frame();
    expect(t.clock.pending()).toBe(false);
    t.setLevel(1);
    t.clock.frame(2000);
    t.document.setHidden(false);
    expect(t.clock.pending()).toBe(true);
    t.clock.frame();
    expect(t.ring.style.transform).toBe('scale(1.45)');
    expect(t.scaleOf(t.bars[27])).toBeCloseTo(1, 5);
    expect(t.scaleOf(t.bars[26])).toBeCloseTo(13 / 53, 3);
    t.engine.destroy();
  });

  it('destroy stops its frames and its listener', () => {
    const t = setup();
    t.engine.recording(true);
    t.engine.destroy();
    expect(t.clock.pending()).toBe(false);
    expect(t.document.listeners.size).toBe(0);
  });
});
