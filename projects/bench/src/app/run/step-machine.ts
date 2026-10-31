import type { StepOutcome } from '../measure/stats';

/*
 * One ladder's climb (design 2.3 and 2.4): each step is built, warmed up and measured in timed
 * phases; the stop rule ends the climb, and an optional refinement bisects the knee. Pure: the page
 * drives it with rAF timestamps (`tick`), says when a step's input is drawn (`built`) and hands
 * over each step's outcome (`judged`); the specs drive it on a fake clock. It cannot loop forever:
 * it runs at most the ladder's levels plus two refinement steps, and a step that takes over three
 * times its planned time is aborted. It skips nothing: a phase starts on the frame that ends the
 * one before, so a long frame stretches a phase instead of jumping past the next, and the climb
 * records every level it reaches, in order. A stretched phase ends at the next stage's start, so
 * its statistics take their window from the recorder's marks on those two frames, not from the
 * phase's `ms` (`FrameRecorder.between`; see `PhaseFrames`).
 */

/** A measured phase: its name in the result and its planned time. */
export interface PhaseSpec {
  readonly name: string;
  readonly ms: number;
}

/** The design's phases: dots alone, then a pan, a zoom in and out, and everything visible. */
export const MEASURED_PHASES: readonly PhaseSpec[] = [
  { name: 'idle', ms: 3000 },
  { name: 'pan', ms: 3000 },
  { name: 'zoom', ms: 2000 },
  { name: 'zoomed-out', ms: 2000 },
];
/** Fit, GC settling and the rate history filling, before anything is measured. */
export const WARMUP_MS = 3000;
/** The stop rule: a step under this mean fps, or with a median frame over `STOP_P50_MS`. */
export const STOP_FPS = 15;
export const STOP_P50_MS = 100;
/** A step taking over this many times its planned time is aborted as unresponsive. */
const UNRESPONSIVE_FACTOR = 3;
/** Bisections between the last smooth step and the first that is not. */
const REFINE_STEPS = 2;

export interface LadderPlan {
  /** The load of each step, rising: a scale, messages per second or a number of notes. */
  readonly levels: readonly number[];
  readonly phases: readonly PhaseSpec[];
  readonly warmupMs: number;
  /** Bisect the knee after the climb, so capacities are not quantised to the ladder's steps. */
  readonly refine: boolean;
  readonly stopFps: number;
}

export interface Step {
  /** Its place among all the ladder's steps, refinement included, from 0. */
  readonly index: number;
  readonly level: number;
  readonly refining: boolean;
  /** When it was issued, before its build: the unresponsive limit counts from here. */
  readonly startedAt: number;
}

export type Stage =
  | { readonly kind: 'ready' }
  /** The page applies the step's level and reports `built` once it is drawn. */
  | { readonly kind: 'build'; readonly step: Step }
  | { readonly kind: 'warmup'; readonly step: Step; readonly since: number; readonly until: number }
  | {
      readonly kind: 'phase';
      readonly step: Step;
      readonly phase: PhaseSpec;
      readonly since: number;
      readonly until: number;
    }
  /** The page computes the step's outcome from its phases and reports it with `judged`. */
  | { readonly kind: 'judge'; readonly step: Step }
  | { readonly kind: 'done' };

export interface StepRecord {
  readonly step: Step;
  readonly outcome?: StepOutcome;
  readonly aborted?: 'unresponsive';
}

/** Why the climb ended: the stop rule, a step that froze, or the last level reached. */
export type LadderEnd = 'stop-rule' | 'unresponsive' | 'cap';

/** Why a refinement that was asked for did not run: it needs a smooth step and one that is not. */
export type RefineSkipped = 'no-smooth-step' | 'no-failing-step';

export class StepMachine {
  private current: Stage = { kind: 'ready' };
  private readonly done: StepRecord[] = [];
  private end: LadderEnd | null = null;
  private skipped: RefineSkipped | null = null;
  /** The knee's bracket while refining: the highest smooth level and the lowest that is not. */
  private bracket: { low: number; high: number } | null = null;
  private refined = 0;
  private readonly plannedMs: number;

  constructor(private readonly plan: LadderPlan) {
    const { levels, phases, warmupMs, stopFps } = plan;
    if (levels.length === 0) throw new RangeError('a ladder needs a level');
    levels.forEach((level, i) => {
      if (!Number.isFinite(level) || level < 0 || (i > 0 && level <= levels[i - 1])) {
        throw new RangeError(`levels rise from 0, finite: ${levels.join(', ')}`);
      }
    });
    if (phases.length === 0) throw new RangeError('a step needs a phase to measure');
    if (new Set(phases.map((phase) => phase.name)).size !== phases.length) {
      throw new RangeError('phases are told apart by name: two share one');
    }
    for (const { name, ms } of phases) {
      if (!(ms > 0) || !Number.isFinite(ms)) {
        throw new RangeError(`phase ${name} needs a time, not ${ms}`);
      }
    }
    if (!(warmupMs >= 0) || !Number.isFinite(warmupMs)) {
      throw new RangeError(`a warm-up of ${warmupMs} ms`);
    }
    if (!(stopFps > 0)) throw new RangeError(`a stop fps of ${stopFps}`);
    this.plannedMs = warmupMs + phases.reduce((sum, phase) => sum + phase.ms, 0);
  }

  get stage(): Stage {
    return this.current;
  }

  /** Every step that ended, judged or aborted, in the order they ran. */
  get records(): readonly StepRecord[] {
    return this.done;
  }

  /** Why the climb ended, once it has (refinement may still be running). */
  get ended(): LadderEnd | null {
    return this.end;
  }

  /** Why the refinement asked for did not run; null while it may, or when it was not asked for. */
  get refineSkipped(): RefineSkipped | null {
    return this.skipped;
  }

  start(now: number): void {
    this.expect('ready', 'start');
    this.issue(this.plan.levels[0], false, now);
  }

  built(now: number): void {
    const stage = this.expect('build', 'built');
    if (this.abortIfUnresponsive(stage.step, now)) return;
    this.current = {
      kind: 'warmup',
      step: stage.step,
      since: now,
      until: now + this.plan.warmupMs,
    };
  }

  /** A frame at `now`: ends a timed stage that is due, or aborts a step that froze. */
  tick(now: number): void {
    const stage = this.current;
    if (stage.kind === 'ready' || stage.kind === 'done' || stage.kind === 'judge') return;
    if (this.abortIfUnresponsive(stage.step, now)) return;
    if (stage.kind === 'build' || now < stage.until) return;
    const next = stage.kind === 'warmup' ? 0 : this.plan.phases.indexOf(stage.phase) + 1;
    const phase = this.plan.phases[next];
    this.current = phase
      ? { kind: 'phase', step: stage.step, phase, since: now, until: now + phase.ms }
      : { kind: 'judge', step: stage.step };
  }

  judged(outcome: StepOutcome, now: number): void {
    const { step } = this.expect('judge', 'judged');
    this.done.push({ step, outcome });
    if (step.refining) {
      this.refineNext(step.level, outcome.tier === 'smooth', now);
      return;
    }
    if (outcome.meanFps < this.plan.stopFps || outcome.p50Ms > STOP_P50_MS) {
      this.endClimb('stop-rule', now);
    } else if (step.index + 1 < this.plan.levels.length) {
      this.issue(this.plan.levels[step.index + 1], false, now);
    } else {
      this.endClimb('cap', now);
    }
  }

  private expect<K extends Stage['kind']>(kind: K, call: string): Extract<Stage, { kind: K }> {
    if (this.current.kind !== kind) {
      throw new Error(`${call}() needs the ${kind} stage, not ${this.current.kind}`);
    }
    return this.current as Extract<Stage, { kind: K }>;
  }

  private issue(level: number, refining: boolean, now: number): void {
    const step = { index: this.done.length, level, refining, startedAt: now };
    this.current = { kind: 'build', step };
  }

  private abortIfUnresponsive(step: Step, now: number): boolean {
    if (now - step.startedAt <= UNRESPONSIVE_FACTOR * this.plannedMs) return false;
    this.done.push({ step, aborted: 'unresponsive' });
    if (step.refining) this.refineNext(step.level, false, now);
    else this.endClimb('unresponsive', now);
    return true;
  }

  private endClimb(end: LadderEnd, now: number): void {
    this.end = end;
    if (!this.plan.refine) {
      this.current = { kind: 'done' };
      return;
    }
    // The knee lies below the first step that was not smooth (or froze); the climb was smooth up
    // to the step before it.
    const climb = this.done.filter((record) => !record.step.refining);
    const first = climb.findIndex((record) => record.outcome?.tier !== 'smooth');
    if (first <= 0) {
      this.skipped = first === 0 ? 'no-smooth-step' : 'no-failing-step';
      this.current = { kind: 'done' };
      return;
    }
    this.bracket = { low: climb[first - 1].step.level, high: climb[first].step.level };
    this.issue((this.bracket.low + this.bracket.high) / 2, true, now);
  }

  /** Narrows the bracket by the midpoint `level` just measured, then bisects again or ends. */
  private refineNext(level: number, smooth: boolean, now: number): void {
    const bracket = this.bracket as { low: number; high: number };
    if (smooth) bracket.low = level;
    else bracket.high = level;
    this.refined++;
    if (this.refined < REFINE_STEPS) this.issue((bracket.low + bracket.high) / 2, true, now);
    else this.current = { kind: 'done' };
  }
}
