import type { StepOutcome, Tier } from '../measure/stats';
import {
  type LadderPlan,
  MEASURED_PHASES,
  STOP_FPS,
  type Stage,
  StepMachine,
  WARMUP_MS,
} from './step-machine';

const PHASES = [
  { name: 'idle', ms: 300 },
  { name: 'pan', ms: 200 },
];
/** Warm-up plus phases: what a step is planned to take, 600 ms here. */
const PLANNED_MS = 100 + 300 + 200;
const plan = (change: Partial<LadderPlan> = {}): LadderPlan => ({
  levels: [1, 2, 4, 8, 16],
  phases: PHASES,
  warmupMs: 100,
  refine: false,
  stopFps: STOP_FPS,
  ...change,
});

const SMOOTH: StepOutcome = { meanFps: 60, p50Ms: 16.7, tier: 'smooth' };
const USABLE: StepOutcome = { meanFps: 40, p50Ms: 25, tier: 'usable' };
const SLOW: StepOutcome = { meanFps: 14.9, p50Ms: 60, tier: 'failing' };

/**
 * Drives a machine as the page will, on a fake clock: one tick per 16 ms frame, building at once,
 * and judging each step by `judge(level)`. Returns the stages it passed through, in order.
 */
function drive(machine: StepMachine, judge: (level: number) => StepOutcome): Stage[] {
  let now = 0;
  const seen: Stage[] = [];
  const note = (): void => {
    if (seen.at(-1) !== machine.stage) seen.push(machine.stage);
  };
  machine.start(now);
  note();
  for (let guard = 0; machine.stage.kind !== 'done'; guard++) {
    if (guard > 100_000) throw new Error('the machine did not finish');
    const stage = machine.stage;
    if (stage.kind === 'build') machine.built(now);
    else if (stage.kind === 'judge') machine.judged(judge(stage.step.level), now);
    else {
      now += 16;
      machine.tick(now);
    }
    note();
  }
  return seen;
}

const levelsOf = (machine: StepMachine): number[] =>
  machine.records.map((record) => record.step.level);

describe('StepMachine', () => {
  it('defaults to the design’s phases: warm-up 3 s, then idle, pan, zoom and zoomed-out', () => {
    expect(WARMUP_MS).toBe(3000);
    expect(MEASURED_PHASES).toEqual([
      { name: 'idle', ms: 3000 },
      { name: 'pan', ms: 3000 },
      { name: 'zoom', ms: 2000 },
      { name: 'zoomed-out', ms: 2000 },
    ]);
    expect(STOP_FPS).toBe(15);
  });

  it('builds, warms up and measures each phase of a step in order, each for its time', () => {
    const machine = new StepMachine(plan({ levels: [1] }));

    const stages = drive(machine, () => SMOOTH);

    expect(stages.map((stage) => (stage.kind === 'phase' ? stage.phase.name : stage.kind))).toEqual(
      ['build', 'warmup', 'idle', 'pan', 'judge', 'done'],
    );
    for (const stage of stages) {
      if (stage.kind !== 'warmup' && stage.kind !== 'phase') continue;
      const ms = stage.kind === 'warmup' ? 100 : stage.phase.ms;
      expect(stage.until - stage.since).toBe(ms);
    }
  });

  it('climbs every level in order and ends at the step cap when nothing is slow', () => {
    const machine = new StepMachine(plan());

    drive(machine, () => USABLE);

    expect(levelsOf(machine)).toEqual([1, 2, 4, 8, 16]);
    expect(machine.ended).toBe('cap');
    expect(machine.records.every((record) => record.outcome === USABLE)).toBe(true);
  });

  it('stops after the first step under the stop fps, and records that step', () => {
    const machine = new StepMachine(plan());

    drive(machine, (level) => (level >= 4 ? SLOW : SMOOTH));

    expect(levelsOf(machine)).toEqual([1, 2, 4]);
    expect(machine.records.at(-1)?.outcome).toBe(SLOW);
    expect(machine.ended).toBe('stop-rule');
  });

  it('stops after the first step whose median frame is over 100 ms, at any fps', () => {
    const machine = new StepMachine(plan());
    const slowMedian: StepOutcome = { meanFps: 30, p50Ms: 100.1, tier: 'failing' };

    drive(machine, (level) => (level === 2 ? slowMedian : SMOOTH));

    expect(levelsOf(machine)).toEqual([1, 2]);
    expect(machine.ended).toBe('stop-rule');
  });

  it('keeps climbing at exactly the stop fps and exactly a 100 ms median frame', () => {
    const machine = new StepMachine(plan());

    drive(machine, () => ({ meanFps: STOP_FPS, p50Ms: 100, tier: 'failing' }));

    expect(levelsOf(machine)).toEqual([1, 2, 4, 8, 16]);
    expect(machine.ended).toBe('cap');
  });

  it('takes its stop fps from the plan', () => {
    const machine = new StepMachine(plan({ stopFps: 45 }));

    drive(machine, (level) => (level === 2 ? USABLE : SMOOTH));

    expect(levelsOf(machine)).toEqual([1, 2]);
  });

  it('starts each phase at the frame that ends the last, so a long frame skips none', () => {
    const machine = new StepMachine(plan({ levels: [1] }));
    machine.start(0);
    machine.built(0);

    machine.tick(500); // one frame across the warm-up and both phases' planned time
    expect(machine.stage).toMatchObject({ kind: 'phase', phase: { name: 'idle' }, since: 500 });
    machine.tick(500 + 300);
    expect(machine.stage).toMatchObject({ kind: 'phase', phase: { name: 'pan' }, since: 800 });
    machine.tick(1000);
    expect(machine.stage.kind).toBe('judge');
  });

  it('aborts a step over three times its planned time as unresponsive, and stops', () => {
    const machine = new StepMachine(plan());
    machine.start(0);
    machine.built(0);

    machine.tick(3 * PLANNED_MS + 1); // the page froze for the whole step

    expect(machine.records).toEqual([
      { step: expect.objectContaining({ level: 1 }), aborted: 'unresponsive' },
    ]);
    expect(machine.ended).toBe('unresponsive');
    expect(machine.stage.kind).toBe('done');
  });

  it('times a step from when it was issued, so a build that never ends aborts too', () => {
    const machine = new StepMachine(plan());
    machine.start(1000);

    machine.tick(1000 + 3 * PLANNED_MS);
    expect(machine.stage.kind).toBe('build');
    machine.tick(1000 + 3 * PLANNED_MS + 1);

    expect(machine.records[0].aborted).toBe('unresponsive');
  });

  describe('refinement', () => {
    const tierAt =
      (knee: number) =>
      (level: number): StepOutcome =>
        level <= knee ? SMOOTH : { ...USABLE, tier: 'usable' as Tier };

    it('bisects twice between the last smooth step and the first that is not', () => {
      const machine = new StepMachine(plan({ refine: true }));

      drive(machine, tierAt(5));

      // Smooth to 4, not at 8: then 6 (not smooth), then 5 (smooth).
      expect(levelsOf(machine)).toEqual([1, 2, 4, 8, 16, 6, 5]);
      expect(machine.records.slice(5).every((record) => record.step.refining)).toBe(true);
      expect(machine.ended).toBe('cap');
    });

    it('bisects between the lighter rungs: the midpoints are fractions, exactly', () => {
      const machine = new StepMachine(plan({ refine: true, levels: [0.125, 0.25, 0.5, 1] }));

      drive(machine, tierAt(0.3));

      // Smooth to 1/4, not at 1/2 or 1: then 3/8 (not smooth), then 5/16 (not smooth).
      expect(levelsOf(machine)).toEqual([0.125, 0.25, 0.5, 1, 0.375, 0.3125]);
    });

    it('moves up from a smooth midpoint', () => {
      const machine = new StepMachine(plan({ refine: true }));

      drive(machine, tierAt(6.5));

      expect(levelsOf(machine).slice(5)).toEqual([6, 7]);
    });

    it('refines after the stop rule too, below the step that stopped the climb', () => {
      const machine = new StepMachine(plan({ refine: true }));

      drive(machine, (level) => (level >= 8 ? SLOW : SMOOTH));

      expect(levelsOf(machine)).toEqual([1, 2, 4, 8, 6, 7]);
      expect(machine.ended).toBe('stop-rule');
    });

    it('counts an unresponsive midpoint as not smooth and goes on', () => {
      const machine = new StepMachine(plan({ refine: true, levels: [2, 4] }));
      drive(machine, tierAt(2));
      expect(levelsOf(machine)).toEqual([2, 4, 3, 2.5]);

      const frozen = new StepMachine(plan({ refine: true, levels: [2, 4] }));
      let now = 0;
      frozen.start(now);
      for (const level of [2, 4]) {
        expect(frozen.stage).toMatchObject({ kind: 'build', step: { level } });
        frozen.built(now);
        while (frozen.stage.kind !== 'judge') frozen.tick((now += 16));
        frozen.judged(level === 2 ? SMOOTH : USABLE, now);
      }
      expect(frozen.stage).toMatchObject({ kind: 'build', step: { level: 3, refining: true } });
      frozen.tick(now + 3 * PLANNED_MS + 1);

      expect(frozen.records[2].aborted).toBe('unresponsive');
      expect(frozen.stage).toMatchObject({ kind: 'build', step: { level: 2.5 } });
    });

    it('says why it did not refine: no smooth step, or no step that was not', () => {
      const none = new StepMachine(plan({ refine: true }));
      drive(none, () => SLOW);
      expect(levelsOf(none)).toEqual([1]);
      expect(none.refineSkipped).toBe('no-smooth-step');

      const all = new StepMachine(plan({ refine: true }));
      drive(all, () => SMOOTH);
      expect(levelsOf(all)).toEqual([1, 2, 4, 8, 16]);
      expect(all.refineSkipped).toBe('no-failing-step');
    });

    it('brackets the knee at the first step that is not smooth, even if a later one is', () => {
      const machine = new StepMachine(plan({ refine: true }));

      drive(machine, (level) => (level === 4 ? USABLE : SMOOTH));

      expect(levelsOf(machine).slice(5)).toEqual([3, 3.5]);
    });

    it('does not refine unless asked', () => {
      const machine = new StepMachine(plan());

      drive(machine, tierAt(5));

      expect(levelsOf(machine)).toEqual([1, 2, 4, 8, 16]);
      expect(machine.refineSkipped).toBeNull();
    });
  });

  it('ends within its levels plus two refinement steps, recording every level it climbs', () => {
    const tiers: Tier[] = ['smooth', 'usable', 'failing'];
    for (let seed = 1; seed <= 200; seed++) {
      const levels = Array.from({ length: 1 + (seed % 9) }, (_, i) => 2 ** i);
      const machine = new StepMachine(plan({ levels, refine: seed % 2 === 0 }));
      let state = seed;
      const random = (): number => {
        state = (state * 1103515245 + 12345) % 2 ** 31;
        return state / 2 ** 31;
      };

      drive(machine, () => {
        const tier = tiers[Math.floor(random() * 3)];
        return { meanFps: tier === 'failing' ? 10 : 50, p50Ms: 20, tier };
      });

      const climbed = machine.records.filter((record) => !record.step.refining);
      expect(levelsOf(machine).length).toBeLessThanOrEqual(levels.length + 2);
      expect(climbed.map((record) => record.step.level)).toEqual(levels.slice(0, climbed.length));
      expect(machine.records.map((record) => record.step.index)).toEqual(
        machine.records.map((_, i) => i),
      );
    }
  });

  it('refuses a call that does not belong to the stage it is in', () => {
    const machine = new StepMachine(plan());

    expect(() => machine.built(0)).toThrow(/build/);
    machine.start(0);
    expect(() => machine.start(0)).toThrow(/ready/);
    expect(() => machine.judged(SMOOTH, 0)).toThrow(/judge/);
  });

  it.each([
    ['no levels', { levels: [] }],
    ['levels that do not rise', { levels: [1, 2, 2] }],
    ['a level that is not finite', { levels: [1, Number.POSITIVE_INFINITY] }],
    ['a negative level', { levels: [-1, 1] }],
    ['no phases', { phases: [] }],
    ['a phase without time', { phases: [{ name: 'idle', ms: 0 }] }],
    ['two phases of one name', { phases: [PHASES[0], PHASES[0]] }],
    ['a negative warm-up', { warmupMs: -1 }],
    ['a stop fps that is not positive', { stopFps: 0 }],
  ])('refuses a plan with %s', (_, change: Partial<LadderPlan>) => {
    expect(() => new StepMachine(plan(change))).toThrow(RangeError);
  });
});
