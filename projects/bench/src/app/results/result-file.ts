import type { BenchRun, PhaseResult, StepResult } from '../run/result';

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
}

export interface RecordedPhase extends PhaseResult {
  readonly cdp?: PhaseCdp;
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
  readonly browserVersion?: string;
  /** False where the file is the part of a campaign that was done when it stopped. */
  readonly complete?: boolean;
}

export interface CampaignResult extends Omit<
  BenchRun,
  'steps' | 'measurement' | 'end' | 'refineSkipped'
> {
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
  if (typeof machine['refreshHz'] !== 'number') {
    return 'not a bench result: the machine has no refreshHz';
  }
  if (!Array.isArray(value['steps'])) return 'not a bench result: it has no list of steps';
  for (const [index, step] of value['steps'].entries()) {
    if (!isObject(step)) return `step ${index} is not an object`;
    for (const key of ['renderer', 'ladder'] as const) {
      if (typeof step[key] !== 'string') return `step ${index} has no ${key}`;
    }
    for (const key of ['level', 'repeat'] as const) {
      if (typeof step[key] !== 'number') return `step ${index} has no numeric ${key}`;
    }
    if (!isObject(step['phases'])) return `step ${index} has no phases`;
  }
  return null;
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
  return wrong ? { ok: false, error: wrong } : { ok: true, campaign: value as CampaignResult };
}
