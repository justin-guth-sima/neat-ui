import { describe, expect, it } from 'vitest';
import { DESIGN_FRAME_MS, Sampler } from './sampler';

describe('Sampler', () => {
  it('takes a sample every period, from the start', () => {
    const sampler = new Sampler(50);
    sampler.reset(1000);
    expect(sampler.take(1000)).toBe(true);
    expect(sampler.take(1030)).toBe(false);
    expect(sampler.take(1050)).toBe(true);
    expect(sampler.take(1100)).toBe(true);
  });

  it('counts a frame a quarter period early, so a frame that comes early skips no sample', () => {
    const sampler = new Sampler(50);
    sampler.reset(1000);
    sampler.take(1000);
    expect(sampler.take(1037)).toBe(false);
    expect(sampler.take(1038)).toBe(true);
    expect(sampler.take(1087)).toBe(false);
    expect(sampler.take(1088)).toBe(true);
  });

  it('takes at most one a frame, and after a long gap goes on from then', () => {
    const sampler = new Sampler(50);
    sampler.reset(1000);
    sampler.take(1000);
    expect(sampler.take(5000)).toBe(true);
    expect(sampler.take(5016)).toBe(false);
    expect(sampler.take(5050)).toBe(true);
  });

  it('takes 60 a second at 60, 120 and 144 frames a second', () => {
    for (const rate of [60, 120, 144]) {
      const sampler = new Sampler(DESIGN_FRAME_MS);
      sampler.reset(0);
      let taken = 0;
      for (let frame = 0; frame < rate; frame++) if (sampler.take((frame * 1000) / rate)) taken++;
      expect(taken).toBeGreaterThanOrEqual(59);
      expect(taken).toBeLessThanOrEqual(61);
    }
  });
});
