import type { DotProbeBuffer, DotProbeStats } from '../measure/dot-probe';
import type { FrameRecorder, Refresh } from '../measure/frame-recorder';
import type { LoafCollector } from '../measure/loaf-collector';
import { frameStats, type PhaseFrames, stepOutcome } from '../measure/stats';
import {
  dotsResult,
  type PhaseResult,
  phaseResult,
  type RendererId,
  type StepResult,
  type Transform,
} from './result';
import {
  type LadderEnd,
  type LadderPlan,
  type PhaseSpec,
  type RefineSkipped,
  type Stage,
  StepMachine,
} from './step-machine';

/*
 * Drives the step machine with the page's frames (design 2.3 and 4.1): on each frame it ticks the
 * machine, plays the phase's gesture, takes each phase's frame statistics, long frames and dot
 * draws at the phase's end, and puts a step's result together. The recorder hands it the frames
 * (its `onFrame` is `frame`); everything it does to the page goes through `DriverHost`, so the
 * specs run it on a fake rAF and a fake host. A raw-browser-API unit's sibling (AGENTS.md): no
 * Angular, no signals.
 *
 * Per step: on the first frame it applies the step's load (the clock is read first: the build
 * starts there), then waits for the view to show the step's start transform. The build ends on
 * the frame after the one that saw it (the frame that painted it): "time to first paint" is the
 * first frame after the start transform. After the last phase it puts the view back at the start
 * and waits for it before the next step, so a step starts from a fit and its build is not
 * charged for the last step's zoomed-out view. The message feed is the host's (`feedMessages`
 * restarts it when a step is applied); the driver only changes the step.
 */

/** What the driver asks of the page's host. */
export interface DriverHost {
  /** Puts the level's load on the page: a new diagram input, new rates, or both. */
  apply(level: number): void;
  /** Whether the view shows the start transform (the kit's fit of the current diagram). */
  atStart(): boolean;
  /** Puts the view back at the start transform; the host may take frames to get there. */
  fit(): void;
  /** The step's gestures; asked once per step, after `apply`. */
  player(): GesturePlayerPort;
  /** The step's load as numbers, for the result. */
  params(level: number): StepResult['params'];
  /** The transform the view shows now. */
  transform(): Transform;
  /** The page's element count: what a renderer costs in DOM. */
  domNodes(): number;
}

/** What the driver needs of `GesturePlayer`. */
export interface GesturePlayerPort {
  begin(phase: string, nowMs: number, durationMs: number): void;
  frame(nowMs: number): void;
  end(): void;
}

/** What the driver needs of `LoafCollector`. */
export type LoafPort = Pick<LoafCollector, 'source' | 'lost' | 'reset' | 'summarize'>;

export interface DriverOptions {
  readonly plan: LadderPlan;
  readonly ladder: string;
  readonly renderer: RendererId;
  readonly repeat: number;
  /** Its `onFrame` must call `frame`, and it must be running (or started right after). */
  readonly recorder: FrameRecorder;
  readonly loaf: LoafPort;
  readonly probe: DotProbeBuffer;
  /** The dot layer's cap: a phase that drew this many dots was cut short. */
  readonly maxDots: number;
  /** The run's display refresh (calibrated before the first step). */
  readonly refresh: Refresh;
  readonly host: DriverHost;
  /** The clock of rAF timestamps (`performance.now()`). */
  readonly clock?: () => number;
  /** Frames a step may wait for its view to return to the start, before it goes on. */
  readonly settleFrames?: number;
}

/** About two seconds at 60 Hz: a view that is not back by then will not come. */
const SETTLE_FRAMES = 120;
/** The fastest display the bench plans for, for the recorder's buffer. */
const MAX_HZ = 144;
/** The step machine aborts a step at three times its planned time. */
const ABORT_FACTOR = 3;

/** The frames a recorder must hold for one step of `plan`, up to the machine's abort of it. */
export function frameCapacity(plan: LadderPlan): number {
  const plannedMs = plan.warmupMs + plan.phases.reduce((sum, phase) => sum + phase.ms, 0);
  return Math.ceil((ABORT_FACTOR * plannedMs * MAX_HZ) / 1000) + 1024;
}

export type Gesture = 'idle' | 'pan' | 'zoom' | 'zoomed-out';

const GESTURES: readonly string[] = ['idle', 'pan', 'zoom', 'zoomed-out'];

/** The gesture a phase plays: its own, or none for a soak's minutes. A new phase must say. */
export function gestureFor(phase: string): Gesture {
  if (phase.startsWith('soak-')) return 'idle';
  if (!GESTURES.includes(phase)) throw new Error(`no gesture for the phase ${phase}`);
  return phase as Gesture;
}

export class PhaseDriver {
  private readonly machine: StepMachine;
  private readonly clock: () => number;
  private readonly settleLimit: number;
  private readonly results: StepResult[] = [];
  private readonly notes: string[] = [];
  private begun = false;
  /** The build stage the per-step state below belongs to. */
  private building: Stage | null = null;
  private applied = false;
  private seenStart = false;
  private buildStartedAt = 0;
  private buildMs: number | undefined;
  private startTransform: Transform | undefined;
  private player: GesturePlayerPort | null = null;
  private phases: Record<string, PhaseResult> = {};
  private frameSets: PhaseFrames[] = [];
  private dotStats: DotProbeStats[] = [];
  /** The open phase's first frame (a recorder mark), its time and the probe's mark. */
  private open: { from: number; at: number; probe: number } | null = null;
  private settling = 0;

  constructor(private readonly options: DriverOptions) {
    this.machine = new StepMachine(options.plan);
    this.clock = options.clock ?? (() => performance.now());
    this.settleLimit = options.settleFrames ?? SETTLE_FRAMES;
  }

  /** Every step that ended, judged or aborted, in order. */
  get steps(): readonly StepResult[] {
    return this.results;
  }

  /** What went wrong without stopping the run: a view that did not come back. */
  get warnings(): readonly string[] {
    return this.notes;
  }

  get finished(): boolean {
    return this.machine.stage.kind === 'done';
  }

  get end(): LadderEnd | null {
    return this.machine.ended;
  }

  get refineSkipped(): RefineSkipped | null {
    return this.machine.refineSkipped;
  }

  /** Where the climb is, for the page and the specs: `phase:pan`, `build`, `done`. */
  get stage(): string {
    const stage = this.machine.stage;
    return stage.kind === 'phase' ? `phase:${stage.phase.name}` : stage.kind;
  }

  /** Begins the climb; its first step is applied on the next frame. */
  start(now: number): void {
    if (this.begun) throw new Error('the climb has already started');
    this.begun = true;
    this.machine.start(now);
  }

  /** One frame, at the rAF timestamp `t`: hand this to the recorder as `onFrame`. */
  frame(t: number): void {
    if (!this.begun || this.finished) return;
    const before = this.machine.stage;
    const recorded = this.machine.records.length;
    this.machine.tick(t);
    this.afterMachine(before, recorded, t);
    if (this.finished) return;
    const stage = this.machine.stage;
    if (stage.kind === 'build') this.build(stage, t);
    else if (stage.kind === 'phase') this.player?.frame(t);
    else if (stage.kind === 'judge') this.settle(t);
  }

  /** Whatever a tick, a `built` or a `judged` did to the machine: a stage that ended, or a step. */
  private afterMachine(before: Stage, recorded: number, t: number): void {
    // A step the machine gave up on adds a record that says so; a judged step adds one too.
    if (this.machine.records.length > recorded && this.machine.records.at(-1)?.aborted) {
      this.abort();
    } else if (this.machine.stage !== before) {
      if (before.kind === 'phase') this.endPhase(before.phase, t);
      const stage = this.machine.stage;
      if (stage.kind === 'phase') this.beginPhase(stage.phase, t);
      else if (stage.kind === 'judge') this.beginSettle();
    }
  }

  private build(stage: Extract<Stage, { kind: 'build' }>, t: number): void {
    const { host, recorder, loaf, probe } = this.options;
    if (this.building !== stage) {
      // A new step: nothing of the last one's frames, long frames or draws carries over.
      this.building = stage;
      this.applied = false;
      this.seenStart = false;
      this.buildMs = undefined;
      this.startTransform = undefined;
      this.player = null;
      this.phases = {};
      this.frameSets = [];
      this.dotStats = [];
      this.open = null;
      recorder.reset();
      loaf.reset();
      probe.reset();
    }
    if (!this.applied) {
      this.buildStartedAt = this.clock();
      host.apply(stage.step.level);
      this.applied = true;
    } else if (this.seenStart) {
      // The frame after the one that saw the start transform: that one has painted it.
      this.buildMs = t - this.buildStartedAt;
      this.startTransform = host.transform();
      this.player = host.player();
      this.step(() => this.machine.built(t), t);
    } else if (host.atStart()) {
      this.seenStart = true;
    }
  }

  /** Calls into the machine and sees what that did to it, as a tick does. */
  private step(call: () => void, t: number): void {
    const before = this.machine.stage;
    const recorded = this.machine.records.length;
    call();
    this.afterMachine(before, recorded, t);
  }

  private beginPhase(phase: PhaseSpec, t: number): void {
    const { recorder, probe } = this.options;
    this.open = { from: recorder.mark(), at: t, probe: probe.mark() };
    this.player?.begin(gestureFor(phase.name), t, phase.ms);
  }

  private endPhase(phase: PhaseSpec, t: number): void {
    const { recorder, loaf, probe, maxDots, refresh } = this.options;
    const open = this.open;
    this.open = null;
    this.player?.end();
    if (!open) return;
    // The window is the real span between the phase's first and last frame: a long frame
    // stretches a phase, and the planned time would flatter it.
    const frames = recorder.between(open.from, recorder.mark());
    const stats = frameStats(frames.deltas, frames.windowMs, refresh.intervalMs);
    const long = loaf.source === 'none' ? undefined : loaf.summarize(open.at, t);
    this.phases[phase.name] = phaseResult(stats, long);
    this.frameSets.push(frames);
    this.dotStats.push(probe.summarySince(open.probe, maxDots));
  }

  /** The last phase is over: bring the view back before the next step builds. */
  private beginSettle(): void {
    this.settling = 0;
    this.options.host.fit();
  }

  private settle(t: number): void {
    const { host, refresh } = this.options;
    const stage = this.machine.stage as Extract<Stage, { kind: 'judge' }>;
    const back = host.atStart();
    if (!back && ++this.settling < this.settleLimit) return;
    if (!back) {
      this.notes.push(
        `step ${stage.step.index}: the view was not back at its start transform after ` +
          `${this.settleLimit} frames; the next step started from where it was`,
      );
    }
    const outcome = stepOutcome(this.frameSets, refresh.intervalMs);
    this.results.push({
      ...this.header(stage.step.index, stage.step.level, stage.step.refining),
      buildMs: this.buildMs,
      startTransform: this.startTransform,
      phases: this.phases,
      outcome,
      dots: dotsResult(this.dotStats),
      dom: { nodes: host.domNodes() },
    });
    this.step(() => this.machine.judged(outcome, t), t);
  }

  /** A step the machine gave up on: what it measured before is kept, and the climb goes on. */
  private abort(): void {
    this.player?.end();
    this.open = null;
    const record = this.machine.records[this.machine.records.length - 1];
    this.results.push({
      ...this.header(record.step.index, record.step.level, record.step.refining),
      buildMs: this.buildMs,
      startTransform: this.startTransform,
      phases: this.phases,
      aborted: 'unresponsive',
    });
  }

  private header(index: number, level: number, refining: boolean) {
    const { renderer, ladder, repeat, host } = this.options;
    return { renderer, ladder, step: index, level, refining, repeat, params: host.params(level) };
  }
}
