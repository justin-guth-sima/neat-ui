import { D1, scaledParams } from '../synth/synth-diagram';
import { LADDERS, ladderPlan, ladderStep } from './ladders';

describe('ladders', () => {
  it('climb the design’s levels (2.4)', () => {
    expect(LADDERS.A.levels).toEqual([1, 2, 4, 8, 16, 32]);
    expect(LADDERS.B.levels[0]).toBe(50);
    expect(LADDERS.B.levels[LADDERS.B.levels.length - 1]).toBe(25600);
    expect(LADDERS.B.levels).toHaveLength(10);
    expect(LADDERS.C.levels).toEqual([0, 4, 8, 16, 32, 64, 128]);
    expect(LADDERS.D.levels).toEqual([1, 2, 4, 8, 16]);
    expect(LADDERS.E.levels).toEqual([1]);
  });

  it('double from step to step, where they double', () => {
    for (const id of ['A', 'B', 'D'] as const) {
      const { levels } = LADDERS[id];
      levels.slice(1).forEach((level, i) => expect(level).toBe(levels[i] * 2));
    }
  });

  it('A scales the diagram of D1 and sends no messages', () => {
    const step = ladderStep('A', 4, 9);
    expect(step.params).toEqual(scaledParams(D1, 4));
    expect(step.msgsPerSec).toBe(0);
    expect(step.seed).toBe(9);
  });

  it('B sends its level in messages per second, demo-like, over D1', () => {
    const step = ladderStep('B', 800, 1);
    expect(step.params).toEqual(D1);
    expect(step.msgsPerSec).toBe(800);
    expect(step.profile).toBe('demo-like');
  });

  it('C sets the notes over D1 at 400 messages per second', () => {
    const step = ladderStep('C', 32, 1);
    expect(step.params).toEqual({ ...D1, notes: 32 });
    expect(step.msgsPerSec).toBe(400);
  });

  it('D scales the diagram, its notes and the messages together', () => {
    const step = ladderStep('D', 8, 1);
    expect(step.params).toEqual(scaledParams(D1, 8));
    expect(step.msgsPerSec).toBe(400 * 8);
  });

  it('E holds D1 at 800 messages per second', () => {
    const step = ladderStep('E', 1, 1);
    expect(step.params).toEqual(D1);
    expect(step.msgsPerSec).toBe(800);
  });

  it('takes a level between the ladder’s own, as the knee refinement asks, in whole counts', () => {
    expect(ladderStep('C', 12.4, 1).params.notes).toBe(12);
    expect(ladderStep('B', 75, 1).msgsPerSec).toBe(75);
    expect(ladderStep('A', 3, 1).params).toEqual(scaledParams(D1, 3));
  });

  it('refuses a level below nothing, or not a number', () => {
    expect(() => ladderStep('A', -1, 1)).toThrow(/level -1/);
    expect(() => ladderStep('A', Number.NaN, 1)).toThrow(RangeError);
  });

  describe('ladderPlan', () => {
    it('is the ladder’s levels over the design’s phases, in 10 s of measuring after 3 s', () => {
      const plan = ladderPlan('B', { refine: false });
      expect(plan.levels).toEqual(LADDERS.B.levels);
      expect(plan.phases.map((phase) => phase.name)).toEqual(['idle', 'pan', 'zoom', 'zoomed-out']);
      expect(plan.phases.reduce((sum, phase) => sum + phase.ms, 0)).toBe(10000);
      expect(plan.warmupMs).toBe(3000);
    });

    it('takes the first `steps` levels', () => {
      expect(ladderPlan('A', { steps: 3 }).levels).toEqual([1, 2, 4]);
    });

    it('refuses no step, and more steps than the ladder has', () => {
      expect(() => ladderPlan('A', { steps: 0 })).toThrow(RangeError);
      expect(() => ladderPlan('A', { steps: 7 })).toThrow(/6/);
    });

    it('soaks for ten minutes in one-minute phases, so no phase outgrows the probe’s ring', () => {
      const plan = ladderPlan('E');
      expect(plan.phases).toHaveLength(10);
      expect(plan.phases.every((phase) => phase.ms === 60000)).toBe(true);
      expect(new Set(plan.phases.map((phase) => phase.name)).size).toBe(10);
    });
  });
});
