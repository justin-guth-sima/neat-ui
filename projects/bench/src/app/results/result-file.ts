import type { BenchRun, MachineInfo, PhaseResult, StepResult } from '../run/result';

/*
 * What the harness writes for a campaign (`harness/merge.mjs`): the page's result schema
 * (`run/result.ts`) with the harness's additions laid over it. The results view reads these files
 * and nothing else; `parseCampaign` checks only what the view reads, so a file from a later
 * harness with more in it still loads.
 */

/** The browser's counters over a phase (`harness/metrics.mjs`), where the harness had them. */
export interface PhaseCdp {
  readonly fromS?: number;
  readonly toS?: number;
  readonly wallMs: number;
  readonly taskMs: number;
  readonly scriptMs: number;
  readonly styleMs: number;
  readonly layoutMs: number;
  /** Main-thread task time over wall time: the headroom a renderer that holds 60 fps has left. */
  readonly busyShare: number | null;
  readonly styleCount: number;
  readonly layoutCount: number;
  /** The heap in use where the phase ended (not a difference): a soak's trend over its phases. */
  readonly heapBytes?: number;
}

export interface RecordedPhase extends PhaseResult {
  readonly cdp?: PhaseCdp;
  /**
   * What the display presented per second in the phase, from the traced run of the same load
   * (`harness/trace-check.mjs`): only where the view changes in every frame (a pan, a zoom, a step
   * with messages in flight) and only where a trace was taken. The tier uses the lower of this
   * and `fps`, the recorder's.
   */
  readonly presentedFps?: number;
}

export interface RecordedStep extends Omit<StepResult, 'phases' | 'dom'> {
  readonly phases: Readonly<Record<string, RecordedPhase>>;
  readonly dom?: {
    readonly nodes: number;
    readonly cdpNodes?: number;
    readonly listeners?: number;
  };
  readonly heapBytes?: number;
  readonly screenshot?: string;
  /** The harness kept this step of a page load that did not finish. */
  readonly failedRun?: true;
}

/** What the recorder-against-trace check found for a traced run (`harness/trace-check.mjs`). */
export interface RecorderCheck {
  readonly ok: boolean | null;
  readonly tolerance: number;
  readonly compared: number;
  readonly worstPct: number;
  /** Gesture phases in which the trace shows no display draw: not checked, not a failure. */
  readonly unreadable?: number;
  /** Why it was not made, for a renderer the gestures move nothing in. */
  readonly skipped?: string;
}

/** One page load of the campaign, as the harness lists it. */
export interface RunEntry {
  readonly ladder: string;
  readonly renderer: string;
  readonly repeat: number;
  readonly status: 'ok' | 'failed';
  readonly error?: string;
  readonly purpose?: 'trace';
  readonly screenshot?: string;
  readonly trace?: string;
  readonly recorderCheck?: RecorderCheck;
  readonly thermal?: { readonly cpuMhzMin?: number; readonly tempMaxC?: number };
}

export interface HarnessInfo {
  readonly node?: string;
  readonly target?: string;
  readonly headless?: boolean;
  readonly viewport?: { readonly w: number; readonly h: number } | 'native';
  readonly dpr?: string;
  readonly cooldownMs?: number;
  /** What the traced runs recorded (`--trace-categories`); absent in files of older harnesses. */
  readonly traceCategories?: readonly string[];
  readonly browserVersion?: string;
  /** False where the file is the part of a campaign that was done when it stopped. */
  readonly complete?: boolean;
}

/** The page's machine with what the harness adds (`harness/campaign.mjs`). */
export interface RecordedMachine extends MachineInfo {
  /** The extra browser flags the campaign was started with (`--browser-flags`); none: absent. */
  readonly browserFlags?: readonly string[];
}

export interface CampaignResult extends Omit<
  BenchRun,
  'steps' | 'measurement' | 'end' | 'refineSkipped' | 'machine'
> {
  readonly machine: RecordedMachine;
  readonly steps: readonly RecordedStep[];
  /** Absent where no page load finished: the display's own rate is then all there is. */
  readonly measurement: BenchRun['measurement'] | null;
  readonly runs?: readonly RunEntry[];
  readonly harness?: HarnessInfo;
  readonly fairness?: { readonly ok: boolean; readonly problems?: readonly string[] } | null;
}

export type ParsedCampaign =
  | { readonly ok: true; readonly campaign: CampaignResult }
  | { readonly ok: false; readonly error: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Kind = 'string' | 'number' | 'boolean' | 'object' | 'array';

const KIND: Record<Kind, (value: unknown) => boolean> = {
  string: (value) => typeof value === 'string',
  // JSON has no NaN or Infinity: a figure the harness could not compute is written as null.
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  boolean: (value) => typeof value === 'boolean',
  object: isObject,
  array: Array.isArray,
};

/**
 * What is wrong with `value` (named `where`) as an object of `shape`: the first key that is
 * missing or of another kind. `optional` keys are checked only where they are there, so a file of
 * an older harness that lacks them still loads.
 */
function shapeProblem(
  value: unknown,
  where: string,
  shape: Readonly<Record<string, Kind>>,
  optional: Readonly<Record<string, Kind>> = {},
): string | null {
  if (!isObject(value)) return `${where} is not an object`;
  for (const [key, kind] of Object.entries(shape)) {
    if (value[key] === undefined) return `${where} has no ${key}`;
    if (!KIND[kind](value[key])) return `${where}: ${key} is not a ${kind}`;
  }
  for (const [key, kind] of Object.entries(optional)) {
    const present = value[key] !== undefined && value[key] !== null;
    if (present && !KIND[kind](value[key])) return `${where}: ${key} is not a ${kind}`;
  }
  return null;
}

/** The first of `problems`, evaluated in order and only as far as one is found. */
function firstProblem(...problems: readonly (() => string | null)[]): string | null {
  for (const find of problems) {
    const found = find();
    if (found) return found;
  }
  return null;
}

/** What `analysis.ts`, the view and the summary read of a phase, which is `FrameStats`. */
const PHASE_SHAPE: Readonly<Record<string, Kind>> = {
  frames: 'number',
  fps: 'number',
  p50: 'number',
  p95: 'number',
  p99: 'number',
  worst: 'number',
  dropped: 'number',
  droppedPct: 'number',
  janks: 'number',
  stalls: 'number',
};

function phaseProblem(where: string, phase: unknown): string | null {
  return firstProblem(
    () => shapeProblem(phase, where, PHASE_SHAPE, { presentedFps: 'number', partial: 'boolean' }),
    () => {
      const { cdp, loaf } = phase as Record<string, unknown>;
      if (cdp !== undefined && cdp !== null) {
        const wrong = shapeProblem(cdp, `${where}: cdp`, {}, { heapBytes: 'number' });
        if (wrong) return wrong;
        const share = (cdp as Record<string, unknown>)['busyShare'];
        if (share !== undefined && share !== null && !KIND.number(share)) {
          return `${where}: cdp.busyShare is not a number`;
        }
      }
      if (loaf !== undefined && loaf !== null) {
        return shapeProblem(loaf, `${where}: loaf`, { count: 'number' });
      }
      return null;
    },
  );
}

function stepProblem(index: number, step: unknown): string | null {
  const where = `step ${index}`;
  return firstProblem(
    () =>
      shapeProblem(
        step,
        where,
        { renderer: 'string', ladder: 'string', level: 'number', repeat: 'number' },
        { buildMs: 'number', aborted: 'string', heapBytes: 'number', screenshot: 'string' },
      ),
    () => {
      const { phases, params } = step as Record<string, unknown>;
      if (!isObject(phases)) return `${where} has no phases`;
      // A step the watchdog gave up on is the harness's own record and has no parameters.
      if (params !== undefined) {
        const wrong = shapeProblem(params, `${where}: params`, {
          blocks: 'number',
          edges: 'number',
          notes: 'number',
          msgsPerSec: 'number',
        });
        if (wrong) return wrong;
      }
      for (const [name, phase] of Object.entries(phases)) {
        const wrong = phaseProblem(`${where}, phase ${name}`, phase);
        if (wrong) return wrong;
      }
      return null;
    },
  );
}

function runProblem(index: number, run: unknown): string | null {
  const where = `run ${index}`;
  return firstProblem(
    () =>
      shapeProblem(
        run,
        where,
        { ladder: 'string', renderer: 'string', repeat: 'number', status: 'string' },
        { screenshot: 'string', trace: 'string', purpose: 'string', error: 'string' },
      ),
    () => {
      const check = (run as Record<string, unknown>)['recorderCheck'];
      if (check === undefined || check === null) return null;
      return shapeProblem(
        check,
        `${where}: recorderCheck`,
        { tolerance: 'number', compared: 'number', worstPct: 'number' },
        { skipped: 'string', unreadable: 'number' },
      );
    },
  );
}

/**
 * What the view, the summary and the analysis read of a campaign beyond its steps: a file that
 * lacks one of these would throw while it is laid out, so it is refused here with the name of
 * the field. Lists that say "nothing to report" when empty (`warnings`, `notComparable`) are
 * filled in by `parseCampaign` instead.
 */
function campaignProblem(value: Record<string, unknown>): string | null {
  const machine = value['machine'] as Record<string, unknown>;
  return firstProblem(
    () => shapeProblem(value, 'a bench result', { startedAt: 'string' }),
    () =>
      shapeProblem(value['bench'], 'bench', {
        gitSha: 'string',
        kitVersion: 'string',
        vflowVersion: 'string',
        build: 'string',
      }),
    () =>
      shapeProblem(machine, 'machine', {
        ua: 'string',
        cores: 'number',
        dpr: 'number',
        viewport: 'object',
      }),
    () => shapeProblem(machine['viewport'], 'machine.viewport', { w: 'number', h: 'number' }),
    () => {
      const refresh = machine['refreshHz'] as number;
      return refresh > 0 ? null : `not a bench result: the machine's refreshHz is ${refresh}`;
    },
    () =>
      shapeProblem(value['config'], 'config', {
        seed: 'number',
        repeats: 'number',
        ladders: 'array',
      }),
    () => {
      const measurement = value['measurement'];
      if (measurement === undefined || measurement === null) return null;
      const { refresh, loaf } = measurement as Record<string, unknown>;
      return firstProblem(
        () =>
          shapeProblem(measurement, 'measurement', {
            refresh: 'object',
            loaf: 'object',
            build: 'string',
          }),
        () => shapeProblem(refresh, 'measurement.refresh', { intervalMs: 'number' }),
        () => shapeProblem(loaf, 'measurement.loaf', { limits: 'string' }),
      );
    },
    () => {
      for (const key of ['warnings', 'notComparable']) {
        if (value[key] !== undefined && !Array.isArray(value[key])) return `${key} is not an array`;
      }
      return null;
    },
    () => {
      const harness = value['harness'];
      return harness === undefined || harness === null
        ? null
        : shapeProblem(harness, 'harness', {}, { complete: 'boolean', headless: 'boolean' });
    },
    () => {
      const runs = value['runs'];
      if (runs === undefined || runs === null) return null;
      if (!Array.isArray(runs)) return 'runs is not an array';
      for (const [index, run] of runs.entries()) {
        const wrong = runProblem(index, run);
        if (wrong) return wrong;
      }
      return null;
    },
  );
}

/** What is wrong with the parsed `value` as a campaign file, or null where nothing is. */
function problem(value: unknown): string | null {
  if (!isObject(value)) return 'not a bench result (not a JSON object)';
  if (value['schema'] === undefined) return 'not a bench result: it has no schema field';
  if (value['schema'] !== 1) {
    return `not a result this page reads: schema ${String(value['schema'])}, it reads schema 1`;
  }
  const machine = value['machine'];
  if (!isObject(machine) || typeof machine['label'] !== 'string') {
    return 'not a bench result: it has no machine with a label';
  }
  if (machine['refreshHz'] === undefined) return noRefreshProblem(value);
  if (typeof machine['refreshHz'] !== 'number') {
    return 'not a bench result: the machine’s refreshHz is not a number';
  }
  if (!Array.isArray(value['steps'])) return 'not a bench result: it has no list of steps';
  for (const [index, step] of value['steps'].entries()) {
    const wrong = stepProblem(index, step);
    if (wrong) return wrong;
  }
  return campaignProblem(value);
}

/**
 * The machine of a campaign in which no page load finished has no refresh rate: the harness writes
 * such a file on purpose (`merge.mjs` takes the machine from the first run that finished).
 */
function noRefreshProblem(value: Record<string, unknown>): string {
  const runs = value['runs'];
  const noneFinished =
    Array.isArray(runs) && !runs.some((run) => isObject(run) && run['status'] === 'ok');
  if (!noneFinished) return 'not a bench result: the machine has no refreshHz';
  const first = Array.isArray(value['warnings']) ? value['warnings'][0] : undefined;
  return (
    'no page load of this campaign finished, so there is nothing to show' +
    (typeof first === 'string' ? ` (its first warning: ${first})` : '')
  );
}

/** The campaign in `text`, or why it is not one: the message names the first thing wrong. */
export function parseCampaign(text: string): ParsedCampaign {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `not JSON (${(error as Error).message})` };
  }
  const wrong = problem(value);
  if (wrong) return { ok: false, error: wrong };
  const file = value as Record<string, unknown>;
  // An absent list of warnings or notes says there are none.
  const texts = (list: unknown): string[] =>
    Array.isArray(list) ? list.filter((item) => typeof item === 'string') : [];
  return {
    ok: true,
    campaign: {
      ...file,
      warnings: texts(file['warnings']),
      notComparable: texts(file['notComparable']),
    } as unknown as CampaignResult,
  };
}
