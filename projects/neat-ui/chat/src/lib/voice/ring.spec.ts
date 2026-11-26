import { describe, expect, it } from 'vitest';
import { listeningHost } from './listening.testing';
import { RingEngine } from './ring';

/** A push-to-talk host as the template renders it for the ring. */
function setup() {
  const host = document.createElement('div');
  host.innerHTML = '<span class="ring"></span>';
  const t = listeningHost(host);
  const engine = new RingEngine(t.deps);
  const ring = host.querySelector<HTMLElement>('.ring')!;
  return { ...t, engine, ring };
}

describe('RingEngine', () => {
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

  it('release rests the ring and stops the frames at once', () => {
    const t = setup();
    t.setLevel(0.8);
    t.engine.recording(true);
    t.clock.frame();
    t.engine.recording(false);
    expect(t.ring.style.transform).toBe('scale(1)');
    expect(t.ring.style.opacity).toBe('0.6');
    t.clock.frame();
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
