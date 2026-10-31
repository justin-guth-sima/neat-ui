import type { DotProbeStats } from '../measure/dot-probe';
import type { Refresh } from '../measure/frame-recorder';
import type { LoafSource, LoafSummary } from '../measure/loaf-collector';
import type { FrameStats, StepOutcome } from '../measure/stats';
import type { LadderEnd, LadderPlan, RefineSkipped } from './step-machine';

/*
 * What a run writes (design 4.2): the result of one page's climb of one ladder on one renderer,
 * as JSON the harness reads from `window.benchResult` and a board without a harness downloads. The
 * types are the design's schema, with the additions each carries a comment for; the functions turn
 * what the measuring units hand over into it. Pure.
 */

export type RendererId = 'kit' | 'vflow' | 'vflow-virt' | 'none';

export interface Transform {
  readonly k: number;
  readonly x: number;
  readonly y: number;
}

/** A phase's long animation frames. Null where the source (long tasks) cannot tell. */
export interface LoafResult {
  readonly source: LoafSource;
  readonly count: number;
  readonly totalMs: number;
  readonly worstMs: number;
  readonly blockingMs: number | null;
  readonly styleLayoutMs: number | null;
  readonly topScripts: readonly { readonly key: string; readonly ms: number }[];
}

export interface PhaseResult extends FrameStats {
  readonly loaf?: LoafResult;
  /** Addition: the phase was cut short by an aborted step, so its numbers cover part of it. */
  readonly partial?: true;
}

export interface DotsResult {
  readonly drawP50: number;
  readonly drawP95: number;
  readonly drawWorst: number;
  readonly drawnP50: number;
  readonly drawnMax: number;
  readonly capped: boolean;
}

export interface StepResult {
  readonly renderer: RendererId;
  readonly ladder: string;
  /** Its place among the ladder's steps from 0, refinement steps included. */
  readonly step: number;
  /** Addition: the ladder's level this step ran (a scale, messages per second or notes). */
  readonly level: number;
  /** Addition: a bisection step between the climb's last smooth step and its first that was not. */
  readonly refining: boolean;
  readonly repeat: number;
  readonly params: {
    readonly blocks: number;
    readonly edges: number;
    readonly notes: number;
    readonly msgsPerSec: number;
  };
  /** Time to first paint: see `BUILD_DEFINITION`. Absent where the step was aborted before it. */
  readonly buildMs?: number;
  /** Where the view stood when the step's build ended: the transform both hosts start from. */
  readonly startTransform?: Transform;
  readonly phases: Readonly<Record<string, PhaseResult>>;
  /** Addition: the verdict the stop rule and the knee refinement used. */
  readonly outcome?: StepOutcome;
  readonly dots?: DotsResult;
  readonly dom?: { readonly nodes: number };
  readonly aborted?: 'unresponsive';
  /** Addition: the stage the aborted step froze in (`build`, `warmup`, `phase:<name>`). */
  readonly abortedIn?: string;
}

export interface BenchRun {
  readonly schema: 1;
  readonly runId: string;
  readonly startedAt: string;
  /** The page knows none of these but the build: the harness fills in the rest (Task 5). */
  readonly bench: {
    readonly gitSha: string;
    readonly kitVersion: string;
    readonly vflowVersion: string;
    readonly build: 'production' | 'development';
  };
  readonly machine: MachineInfo;
  readonly config: {
    readonly seed: number;
    readonly ladders: readonly string[];
    readonly renderers: readonly string[];
    readonly repeats: number;
    readonly warmupMs: number;
    readonly phases: readonly { readonly name: string; readonly ms: number }[];
    readonly input: 'page' | 'cdp';
  };
  readonly steps: readonly StepResult[];
  readonly warnings: readonly string[];
  /** Addition: why the climb ended, and why a refinement asked for did not run. */
  readonly end: LadderEnd | null;
  readonly refineSkipped: RefineSkipped | null;
  /** Addition: how the numbers were taken, so they are read as what they are. */
  readonly measurement: {
    readonly refresh: {
      readonly measuredMs: number;
      readonly hz: number;
      readonly intervalMs: number;
    };
    readonly loaf: { readonly source: LoafSource; readonly lost: number; readonly limits: string };
    readonly build: string;
  };
  /** Addition: what the renderers do not share (design 3.3), for the results page to show. */
  readonly notComparable: readonly string[];
}

export interface MachineInfo {
  readonly label: string;
  readonly ua: string;
  readonly uaData?: unknown;
  readonly cores: number;
  readonly deviceMemory?: number;
  readonly dpr: number;
  readonly screen: { readonly w: number; readonly h: number };
  readonly viewport: { readonly w: number; readonly h: number };
  /** Measured (design 1.1): the snapped rate, as judged. */
  readonly refreshHz: number;
  readonly webgl?: { readonly vendor: string; readonly renderer: string };
}

/** What "time to first paint" means, written into every run (design 2.3, reviewed). */
export const BUILD_DEFINITION =
  'buildMs runs from the moment the step changes the renderer’s input to the first frame after ' +
  'the start transform is on screen: the frame after the one that first shows the kit’s fit for ' +
  'the box. It includes the first route and measure, and ends at a frame, not at a paint ' +
  'timestamp.';

/**
 * The long-frame source's limits, written into every run so a quiet result is read right. They
 * differ by source: long animation frames list the scripts of a frame and its style and layout,
 * long tasks (older browsers) have a duration and nothing else.
 */
export function loafLimits(source: LoafSource): string {
  switch (source) {
    case 'long-animation-frame':
      return (
        'Long animation frames are reported from 50 ms up, and a script is listed only where it ' +
        'ran over 5 ms. A phase with none has no frame over 50 ms, not no hitches: the 17 to ' +
        '50 ms frames of a slow board are in the frame times, never here.'
      );
    case 'longtask':
      return (
        'This browser has no long animation frames, so long tasks are reported instead: from ' +
        '50 ms up, as a duration and nothing else (no script, no style and layout share). A ' +
        'phase with none has no task over 50 ms, not no hitches: the 17 to 50 ms frames of a ' +
        'slow board are in the frame times, never here.'
      );
    case 'none':
      return (
        'This browser reports neither long animation frames nor long tasks: no phase has ' +
        'long-frame data, and the frame times are all there is to read hitches from.'
      );
  }
}

/** What the two renderers do not share, and what favours which (design 3.3 and the reviews). */
export const NOT_COMPARABLE: readonly string[] = [
  'Hover dimming exists only in the kit; vflow would need a bench reimplementation. It is not ' +
    'exercised in either.',
  'The kit’s hidden list of nodes and edges is extra DOM that vflow does not have. It stays in: ' +
    'it is part of the product, so its cost is part of the kit’s.',
  'Text in foreignObject (vflow’s HTML nodes and labels) against positioned HTML (the kit), and ' +
    'change detection per zoom event (vflow) against a direct style write (the kit), are real ' +
    'differences. They are what is measured, not noise.',
  'Edge labels are drawn in the kit’s front layer, above the blocks, and in vflow’s edge layer; ' +
    'where a label and a block overlap, which is on top can differ (the screenshots show it). ' +
    'This is a difference in the picture, the label z-order, not in its cost.',
  'The kit measures each note with a ResizeObserver to place it; the bench places vflow’s notes ' +
    'at the kit’s fixed note box, so only the kit pays for that observation.',
  'The dot layer learns vflow’s transform through the host’s change detection: dots follow a pan ' +
    'one change-detection pass later in vflow, where the kit’s zoom calls the layer as it draws.',
  'Each vflow node has one source and one target handle, not one per port the kit routes ' +
    'through; the fewer handles favour vflow slightly, in build time only.',
];

/** A phase's frame statistics, with its long frames when a collector watched. */
export function phaseResult(stats: FrameStats, loaf: LoafSummary | undefined): PhaseResult {
  return loaf ? { ...stats, loaf: loafResult(loaf) } : { ...stats };
}

export function loafResult(summary: LoafSummary): LoafResult {
  return {
    source: summary.source,
    count: summary.frames,
    totalMs: summary.totalMs,
    worstMs: summary.largestMs,
    blockingMs: summary.blockingTotalMs,
    styleLayoutMs: summary.styleLayoutMs,
    topScripts: summary.scripts.map((script) => ({
      key:
        script.sourceFunctionName || script.sourceURL
          ? `${script.sourceFunctionName} ${script.sourceURL}:${script.sourceCharPosition}`.trim()
          : script.invoker,
      ms: script.durationMs,
    })),
  };
}

/**
 * A step's dot-layer numbers from its phases': each statistic's own maximum over the phases that
 * drew (so the draw time and the dot count may come from different phases), so a quiet idle phase
 * cannot flatter the step. Undefined where no phase drew (no messages, or the layer was not there).
 */
export function dotsResult(phases: readonly DotProbeStats[]): DotsResult | undefined {
  const drawn = phases.filter((phase) => phase.draws > 0);
  if (drawn.length === 0) return undefined;
  const most = (pick: (phase: DotProbeStats) => number | null): number =>
    Math.max(...drawn.map((phase) => pick(phase) ?? 0));
  return {
    drawP50: most((p) => p.drawP50Ms),
    drawP95: most((p) => p.drawP95Ms),
    drawWorst: most((p) => p.drawWorstMs),
    drawnP50: most((p) => p.dotsP50),
    drawnMax: most((p) => p.dotsMax),
    capped: drawn.some((phase) => phase.capped),
  };
}

/** How far the measured interval may be from the snapped one, as a share of the interval. */
const REFRESH_SNAP_TOLERANCE = 0.05;

/**
 * A warning where the display's measured interval is not the common rate it was snapped to: a
 * variable-rate display, or a throttled page. Every judgement uses the snapped interval, so a
 * result from such a run is read with that in mind. Null when they agree (59.94 Hz and 60 do).
 */
export function refreshWarning(refresh: Refresh): string | null {
  if (
    Math.abs(refresh.measuredMs - refresh.intervalMs) <=
    REFRESH_SNAP_TOLERANCE * refresh.intervalMs
  ) {
    return null;
  }
  return (
    `The display's measured refresh, ${(1000 / refresh.measuredMs).toFixed(1)} Hz ` +
    `(${refresh.measuredMs.toFixed(2)} ms a frame), was snapped to ${refresh.hz} Hz, the rate ` +
    'every judgement uses: a variable-rate display or a throttled page.'
  );
}

export interface CompileInput {
  readonly runId: string;
  readonly startedAt: string;
  readonly machine: MachineInfo;
  readonly seed: number;
  readonly ladder: string;
  readonly renderer: RendererId;
  readonly plan: LadderPlan;
  readonly refresh: Refresh;
  readonly loaf: { readonly source: LoafSource; readonly lost: number };
  readonly steps: readonly StepResult[];
  readonly end: LadderEnd | null;
  readonly refineSkipped: RefineSkipped | null;
  /** What the driver noted: a view that did not come back. */
  readonly driverWarnings: readonly string[];
  /** The page's own build (`isDevMode()`): the one thing about the build the page can tell. */
  readonly build: BenchRun['bench']['build'];
  /** Who played the gestures: the page, or the harness through the browser's input. */
  readonly input: BenchRun['config']['input'];
}

/** The run's JSON: what the driver measured, with how it was measured and what to read it by. */
export function compileRun(input: CompileInput): BenchRun {
  const { plan, refresh, loaf } = input;
  const warnings: string[] = [];
  const snapped = refreshWarning(refresh);
  if (snapped) warnings.push(snapped);
  if (input.build === 'development') {
    warnings.push(
      'This is a development build (Angular dev mode runs extra change-detection checks on both ' +
        'renderers): its numbers are not comparable with a production build’s. Measure with ' +
        '`ng build bench` or `ng serve bench -c production`.',
    );
  }
  if (loaf.source === 'none') {
    warnings.push('The browser offers no long-frame source: no phase has long-frame data.');
  }
  if (loaf.lost > 0) {
    warnings.push(
      `${loaf.lost} long-frame entries were dropped (the collector's limit): the counts of the ` +
        'some phases are lower bounds.',
    );
  }
  for (const step of input.steps) {
    if (step.dots?.capped) {
      warnings.push(`step ${step.step}: the dot layer hit its cap, so the load was cut short.`);
    }
    if (step.aborted) {
      warnings.push(
        `step ${step.step}: aborted as ${step.aborted}` +
          `${step.abortedIn ? ` in ${step.abortedIn}` : ''}; its last phase is partial.`,
      );
    }
  }
  warnings.push(...input.driverWarnings);
  return {
    schema: 1,
    runId: input.runId,
    startedAt: input.startedAt,
    bench: {
      gitSha: 'unknown',
      kitVersion: 'unknown',
      vflowVersion: 'unknown',
      build: input.build,
    },
    machine: input.machine,
    config: {
      seed: input.seed,
      ladders: [input.ladder],
      renderers: [input.renderer],
      repeats: 1,
      warmupMs: plan.warmupMs,
      phases: plan.phases.map(({ name, ms }) => ({ name, ms })),
      input: input.input,
    },
    steps: input.steps,
    warnings,
    end: input.end,
    refineSkipped: input.refineSkipped,
    measurement: {
      refresh: { measuredMs: refresh.measuredMs, hz: refresh.hz, intervalMs: refresh.intervalMs },
      loaf: { source: loaf.source, lost: loaf.lost, limits: loafLimits(loaf.source) },
      build: BUILD_DEFINITION,
    },
    notComparable: NOT_COMPARABLE,
  };
}
