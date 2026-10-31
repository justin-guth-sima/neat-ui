import { type FrameStats, tierOf, type Tier } from '../measure/stats';
import type { CampaignResult, RecordedStep } from './result-file';
import {
  type Evidence,
  fallbackVerdict,
  type FallbackVerdict,
  supportingEvidence,
} from './verdict';

/*
 * What a campaign's steps say, in the numbers the results view and the markdown summary show:
 * each step's tier, each climb's capacity in the two decided tiers (smooth, usable), the medians
 * over the repeats, and the fallback rule's verdict per ladder. Pure, run once per loaded file.
 */

/** The tiers a capacity is asked of: `smooth` is the strict one, `usable` the lenient. */
export type TierGoal = 'smooth' | 'usable';

/** Design 2.4: the results page flags a spread over 10 % between repeats. */
export const SPREAD_FLAG_PCT = 10;

/** The tiers from best to worst; the index is how bad. */
const TIER_ORDER: readonly Tier[] = ['smooth', 'usable', 'failing'];

/** The ladders by their letter, for words (a file may hold a ladder this does not know). */
export const LADDER_NAMES: Readonly<Record<string, string>> = {
  A: 'diagram size',
  B: 'messages per second',
  C: 'notes with live rate cards',
  D: 'size, messages and notes together',
  E: 'soak',
};

/**
 * A trend whose steps differ by less than this many fps is not drawn: a sparkline scales to the
 * range of its own values, so noise of a hundredth of a frame would be drawn as a slope.
 */
const FLAT_FPS = 1;

const RENDERER_ORDER = ['kit', 'vflow', 'vflow-virt', 'none'];

const meets = (tier: Tier, goal: TierGoal): boolean =>
  goal === 'smooth' ? tier === 'smooth' : tier !== 'failing';

/**
 * A step's tier: its worst phase's, judged against the run's refresh `intervalMs`, so a smooth
 * idle phase cannot hide a rough pan. A step that was aborted, or has no phase, fails.
 */
export function stepTier(step: RecordedStep, intervalMs: number): Tier {
  const phases = Object.values(step.phases);
  if (step.aborted || phases.length === 0) return 'failing';
  let worst = 0;
  for (const phase of phases) {
    worst = Math.max(worst, TIER_ORDER.indexOf(tierOf(phase, intervalMs)));
  }
  return TIER_ORDER[worst];
}

/** Mean fps over all of a step's phases: frames over the time they ran for, zero with none. */
export function stepMeanFps(step: RecordedStep): number {
  let frames = 0;
  let seconds = 0;
  for (const phase of Object.values(step.phases)) {
    if (!(phase.fps > 0)) continue;
    frames += phase.frames;
    seconds += phase.frames / phase.fps;
  }
  return seconds > 0 ? frames / seconds : 0;
}

/**
 * The largest load a renderer held: `level` is the last level that met the tier with every
 * smaller one holding too, `null` where even the first did not. `atCap` is a climb that never
 * missed: its capacity is at least `level`, which the climb's cap hid.
 */
export interface Capacity {
  readonly level: number | null;
  readonly atCap: boolean;
}

/**
 * The capacity of a climb's `steps` (levels with their tiers, in any order). A smooth step above
 * a miss does not count: past the knee a step that happens to hold is noise, and the stop rule
 * ended the climb there.
 */
export function capacityOf(
  steps: readonly { readonly level: number; readonly tier: Tier }[],
  goal: TierGoal,
): Capacity {
  let level: number | null = null;
  for (const step of [...steps].sort((a, b) => a.level - b.level)) {
    if (!meets(step.tier, goal)) return { level, atCap: false };
    level = step.level;
  }
  return { level, atCap: level !== null };
}

/** A climb's capacities, ordered: none below every level, then by level, a cap above a miss. */
const capacityKey = (cap: Capacity): number => (cap.level ?? -Infinity) + (cap.atCap ? 0.25 : 0);

export interface CapacitySummary {
  readonly median: Capacity;
  readonly min: Capacity;
  readonly max: Capacity;
  readonly repeats: number;
}

/**
 * The capacities of a renderer's repeats: the lower median, so that what is claimed is the
 * conservative one, with the extremes. Null without a repeat.
 */
export function summariseCapacity(caps: readonly Capacity[]): CapacitySummary | null {
  if (caps.length === 0) return null;
  const sorted = [...caps].sort((a, b) => capacityKey(a) - capacityKey(b));
  return {
    median: sorted[Math.ceil(sorted.length / 2) - 1],
    min: sorted[0],
    max: sorted[sorted.length - 1],
    repeats: sorted.length,
  };
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** A figure over the repeats: its median with its extremes and their spread. */
export interface Stat {
  readonly median: number;
  readonly min: number;
  readonly max: number;
  /** (max - min) as a percentage of the median; the cell is flagged above `SPREAD_FLAG_PCT`. */
  readonly spreadPct: number;
  readonly n: number;
}

export function stat(values: readonly number[]): Stat | null {
  if (values.length === 0) return null;
  const mid = median(values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    median: mid,
    min,
    max,
    spreadPct: max === min ? 0 : mid > 0 ? ((max - min) / mid) * 100 : Infinity,
    n: values.length,
  };
}

const medianTier = (tiers: readonly Tier[]): Tier => {
  const sorted = [...tiers].sort((a, b) => TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b));
  return sorted[sorted.length >> 1];
};

export interface ClimbStep {
  readonly level: number;
  readonly refining: boolean;
  readonly tier: Tier;
  readonly meanFps: number;
  readonly step: RecordedStep;
}

/** One page load's climb of one ladder: a renderer, a repeat, its steps by level. */
export interface Climb {
  readonly ladder: string;
  readonly renderer: string;
  readonly repeat: number;
  /** The page load did not finish, so what it reached is as far as it got. */
  readonly failed: boolean;
  readonly steps: readonly ClimbStep[];
  readonly smooth: Capacity;
  readonly usable: Capacity;
}

type StepParams = RecordedStep['params'];

/** One level of a renderer, over its repeats: the table's row. */
export interface StepCell {
  readonly level: number;
  readonly refining: boolean;
  readonly params: StepParams;
  readonly repeats: number;
  readonly tier: Tier;
  /** Mean fps over all phases. */
  readonly fps: Stat;
  /** The worst phase's p95 frame time, ms; null for a step with no phase. */
  readonly p95Ms: number | null;
  /** The worst phase's dropped share, percent. */
  readonly droppedPct: number | null;
  /** The busiest phase's main-thread share, 0 to 1, where the harness had the counters. */
  readonly busyShare: number | null;
  readonly buildMs: number | null;
  readonly spreadFlag: boolean;
  /** A repeat of this level was aborted (unresponsive or watchdog). */
  readonly aborted: boolean;
}

export interface RendererLadder {
  readonly renderer: string;
  readonly climbs: readonly Climb[];
  readonly smooth: CapacitySummary | null;
  readonly usable: CapacitySummary | null;
  readonly cells: readonly StepCell[];
  /** Median fps by level, lowest first: the capacity table's sparkline. */
  readonly trend: readonly number[];
}

export interface LadderAnalysis {
  readonly ladder: string;
  readonly renderers: readonly RendererLadder[];
  /** What each level put on the page, for words. */
  readonly paramsAt: ReadonlyMap<number, StepParams>;
  /** The decided rule on the smooth tier; null unless the kit and vflow both ran the ladder. */
  readonly verdict: FallbackVerdict | null;
  /** The same rule on the usable tier, shown beside it. */
  readonly usableVerdict: FallbackVerdict | null;
  readonly evidence: Evidence | null;
}

export interface CampaignAnalysis {
  readonly intervalMs: number;
  readonly ladders: readonly LadderAnalysis[];
  /** Page loads that did not finish, across the campaign. */
  readonly failedRuns: number;
}

const medianOrNull = (values: readonly number[]): number | null =>
  values.length > 0 ? median(values) : null;

/**
 * The median over `steps` of each step's worst value of `pick` over its phases; null where no step
 * has one (a step with no phase, a counter the harness did not have).
 */
function worstOf(
  steps: readonly RecordedStep[],
  pick: (phase: RecordedStep['phases'][string]) => number | null | undefined,
): number | null {
  const worst = steps
    .map((step) =>
      Math.max(
        ...Object.values(step.phases).flatMap((phase) => {
          const value = pick(phase);
          return value === null || value === undefined ? [] : [value];
        }),
      ),
    )
    .filter(Number.isFinite);
  return medianOrNull(worst);
}

function cellOf(steps: readonly ClimbStep[]): StepCell {
  const raw = steps.map((s) => s.step);
  const fps = stat(steps.map((s) => s.meanFps)) as Stat;
  return {
    level: steps[0].level,
    refining: steps.some((s) => s.refining),
    params: steps[0].step.params,
    repeats: steps.length,
    tier: medianTier(steps.map((s) => s.tier)),
    fps,
    p95Ms: worstOf(raw, (phase) => phase.p95),
    droppedPct: worstOf(raw, (phase) => phase.droppedPct),
    busyShare: worstOf(raw, (phase) => phase.cdp?.busyShare),
    buildMs: medianOrNull(raw.flatMap((s) => (s.buildMs === undefined ? [] : [s.buildMs]))),
    spreadFlag: steps.length > 1 && fps.spreadPct > SPREAD_FLAG_PCT,
    aborted: raw.some((s) => s.aborted !== undefined),
  };
}

function climbsOf(campaign: CampaignResult, intervalMs: number): Climb[] {
  const failedKeys = new Set(
    (campaign.runs ?? [])
      .filter((run) => run.status === 'failed' && run.purpose !== 'trace')
      .map((run) => `${run.ladder}|${run.renderer}|${run.repeat}`),
  );
  const groups = new Map<string, RecordedStep[]>();
  for (const step of campaign.steps) {
    const key = `${step.ladder}|${step.renderer}|${step.repeat}`;
    groups.set(key, [...(groups.get(key) ?? []), step]);
  }
  return [...groups].map(([key, steps]) => {
    const failed = steps.some((s) => s.failedRun) || failedKeys.has(key);
    const climbSteps: ClimbStep[] = steps
      .map((step) => ({
        level: step.level,
        refining: step.refining,
        tier: stepTier(step, intervalMs),
        meanFps: stepMeanFps(step),
        step,
      }))
      .sort((a, b) => a.level - b.level);
    // A page load that died never reached its cap, whatever its last step did.
    const capacity = (goal: TierGoal): Capacity => {
      const cap = capacityOf(climbSteps, goal);
      return failed ? { ...cap, atCap: false } : cap;
    };
    return {
      ladder: steps[0].ladder,
      renderer: steps[0].renderer,
      repeat: steps[0].repeat,
      failed,
      steps: climbSteps,
      smooth: capacity('smooth'),
      usable: capacity('usable'),
    };
  });
}

function rendererLadder(renderer: string, climbs: readonly Climb[]): RendererLadder {
  const byLevel = new Map<number, ClimbStep[]>();
  for (const climb of climbs) {
    for (const step of climb.steps) {
      byLevel.set(step.level, [...(byLevel.get(step.level) ?? []), step]);
    }
  }
  const cells = [...byLevel].sort(([a], [b]) => a - b).map(([, steps]) => cellOf(steps));
  return {
    renderer,
    climbs,
    smooth: summariseCapacity(climbs.map((c) => c.smooth)),
    usable: summariseCapacity(climbs.map((c) => c.usable)),
    cells,
    trend: cells.map((cell) => cell.fps.median),
  };
}

/** Everything the results view shows of `campaign`. */
export function analyseCampaign(campaign: CampaignResult): CampaignAnalysis {
  const intervalMs = campaign.measurement?.refresh.intervalMs ?? 1000 / campaign.machine.refreshHz;
  const climbs = climbsOf(campaign, intervalMs);
  const letters = [...new Set(climbs.map((c) => c.ladder))].sort();
  const ladders = letters.map((ladder): LadderAnalysis => {
    const ofLadder = climbs.filter((c) => c.ladder === ladder);
    const names = [...new Set(ofLadder.map((c) => c.renderer))].sort(
      (a, b) =>
        (RENDERER_ORDER.indexOf(a) + 1 || RENDERER_ORDER.length + 1) -
        (RENDERER_ORDER.indexOf(b) + 1 || RENDERER_ORDER.length + 1),
    );
    const renderers = names.map((name) =>
      rendererLadder(
        name,
        ofLadder.filter((c) => c.renderer === name),
      ),
    );
    const kit = renderers.find((r) => r.renderer === 'kit');
    const vflow = renderers.find((r) => r.renderer === 'vflow');
    const paramsAt = new Map<number, StepParams>();
    for (const climb of ofLadder) {
      for (const step of climb.steps) {
        if (!paramsAt.has(step.level)) paramsAt.set(step.level, step.step.params);
      }
    }
    return {
      ladder,
      renderers,
      paramsAt,
      verdict: kit && vflow ? fallbackVerdict(kit.climbs, vflow.climbs, 'smooth') : null,
      usableVerdict: kit && vflow ? fallbackVerdict(kit.climbs, vflow.climbs, 'usable') : null,
      evidence: kit && vflow ? supportingEvidence(kit.cells, vflow.cells) : null,
    };
  });
  const failed = new Set(
    climbs.filter((c) => c.failed).map((c) => `${c.ladder}|${c.renderer}|${c.repeat}`),
  );
  for (const run of campaign.runs ?? []) {
    if (run.status === 'failed' && run.purpose !== 'trace') {
      failed.add(`${run.ladder}|${run.renderer}|${run.repeat}`);
    }
  }
  return { intervalMs, ladders, failedRuns: failed.size };
}

/** One phase of one level at the median of the repeats, with the tier those medians reach. */
export interface PhaseRow {
  readonly level: number;
  readonly refining: boolean;
  readonly phase: string;
  readonly fps: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly droppedPct: number;
  readonly janks: number;
  readonly stalls: number;
  readonly busyShare: number | null;
  /** Long animation frames (or long tasks) in the phase; null where none was collected. */
  readonly loafCount: number | null;
  readonly tier: Tier;
  readonly spreadFlag: boolean;
}

const FRAME_FIELDS = [
  'frames',
  'fps',
  'p50',
  'p95',
  'p99',
  'worst',
  'dropped',
  'droppedPct',
  'janks',
  'stalls',
] as const satisfies readonly (keyof FrameStats)[];

/** A renderer's phases by level and name, each at the median of the repeats (`climbs`). */
export function phaseRows(climbs: readonly Climb[], intervalMs: number): PhaseRow[] {
  const levels = new Map<number, ClimbStep[]>();
  for (const climb of climbs) {
    for (const step of climb.steps)
      levels.set(step.level, [...(levels.get(step.level) ?? []), step]);
  }
  const rows: PhaseRow[] = [];
  for (const [level, steps] of [...levels].sort(([a], [b]) => a - b)) {
    const names = [...new Set(steps.flatMap((s) => Object.keys(s.step.phases)))];
    for (const name of names) {
      const phases = steps.flatMap((s) => (s.step.phases[name] ? [s.step.phases[name]] : []));
      const medians = Object.fromEntries(
        FRAME_FIELDS.map((field) => [field, median(phases.map((p) => p[field]))]),
      ) as unknown as FrameStats;
      const fps = stat(phases.map((p) => p.fps)) as Stat;
      rows.push({
        level,
        refining: steps.some((s) => s.refining),
        phase: name,
        fps: medians.fps,
        p50: medians.p50,
        p95: medians.p95,
        p99: medians.p99,
        droppedPct: medians.droppedPct,
        janks: medians.janks,
        stalls: medians.stalls,
        busyShare: medianOrNull(
          phases.flatMap((p) => (p.cdp?.busyShare == null ? [] : [p.cdp.busyShare])),
        ),
        loafCount: medianOrNull(phases.flatMap((p) => (p.loaf ? [p.loaf.count] : []))),
        tier: tierOf(medians, intervalMs),
        spreadFlag: phases.length > 1 && fps.spreadPct > SPREAD_FLAG_PCT,
      });
    }
  }
  return rows;
}

/** The load of a level in words, as the ladder varies it (`params` from a step at that level). */
export function levelText(ladder: string, level: number): string {
  switch (ladder) {
    case 'A':
    case 'D':
      return `×${level}`;
    case 'B':
      return `${level.toLocaleString('en')} msg/s`;
    case 'C':
      return `${level} notes`;
    default:
      return `level ${level}`;
  }
}

/** A level with what it put on the page where the ladder scales the diagram. */
export function loadText(ladder: string, level: number, params: StepParams | undefined): string {
  const short = levelText(ladder, level);
  if (!params) return short;
  if (ladder === 'A') return `${short} (${params.blocks} blocks)`;
  if (ladder === 'D') {
    return `${short} (${params.blocks} blocks, ${params.msgsPerSec.toLocaleString('en')} msg/s)`;
  }
  return short;
}

/** A capacity in words: none, a load, or at least a load where the climb never failed. */
export function capacityText(
  capacity: Capacity,
  ladder: string,
  paramsAt: ReadonlyMap<number, StepParams>,
): string {
  if (capacity.level === null) return 'none';
  const load = loadText(ladder, capacity.level, paramsAt.get(capacity.level));
  return capacity.atCap ? `at least ${load}` : load;
}

/** The capacity over the repeats in words, with the extremes where they differ. */
export function capacitySummaryText(
  summary: CapacitySummary | null,
  ladder: string,
  paramsAt: ReadonlyMap<number, StepParams>,
): string {
  if (!summary) return '–';
  const text = capacityText(summary.median, ladder, paramsAt);
  const short = (cap: Capacity): string =>
    cap.level === null ? 'none' : `${cap.atCap ? 'at least ' : ''}${levelText(ladder, cap.level)}`;
  const differ = summary.min.level !== summary.max.level || summary.min.atCap !== summary.max.atCap;
  return differ ? `${text} (${short(summary.min)} to ${short(summary.max)})` : text;
}

/** Whether a trend (`RendererLadder.trend`) moves too little for its shape to mean anything. */
export function flatTrend(values: readonly number[]): boolean {
  return values.length === 0 || Math.max(...values) - Math.min(...values) < FLAT_FPS;
}
