import type { Tier } from '../measure/stats';
import type { CampaignResult, RecordedPhase, RecordedStep } from './result-file';

/*
 * Result files for the results specs, written compactly: a climb is a list of tiers, one per
 * level, and each tier is a phase whose numbers the real judgement (`tierOf`) puts there at 60 Hz.
 */

export const INTERVAL_MS = 1000 / 60;

const TIER_PHASE: Record<Tier, Omit<RecordedPhase, 'cdp'>> = {
  smooth: {
    frames: 180,
    fps: 60,
    p50: 16.7,
    p95: 17,
    p99: 18,
    worst: 20,
    dropped: 0,
    droppedPct: 0,
    janks: 0,
    stalls: 0,
  },
  usable: {
    frames: 120,
    fps: 40,
    p50: 25,
    p95: 30,
    p99: 60,
    worst: 80,
    dropped: 12,
    droppedPct: 10,
    janks: 4,
    stalls: 1,
  },
  failing: {
    frames: 36,
    fps: 12,
    p50: 80,
    p95: 90,
    p99: 150,
    worst: 200,
    dropped: 60,
    droppedPct: 60,
    janks: 30,
    stalls: 20,
  },
};

/** A phase that judges as `tier`, with `over` laid on it. */
export function phase(tier: Tier, over: Partial<RecordedPhase> = {}): RecordedPhase {
  return { ...TIER_PHASE[tier], ...over };
}

const PHASES = ['idle', 'pan', 'zoom', 'zoomed-out'];

/** A step of `tier` (in every phase) at `level`, `over` laid on it. */
export function step(
  tier: Tier,
  level: number,
  over: Partial<RecordedStep> = {},
  phaseOver: Partial<RecordedPhase> = {},
): RecordedStep {
  return {
    renderer: 'kit',
    ladder: 'A',
    step: 0,
    level,
    refining: false,
    repeat: 0,
    params: { blocks: 30 * level, edges: 36 * level, notes: 8 * level, msgsPerSec: 0 },
    buildMs: 40,
    phases: Object.fromEntries(PHASES.map((name) => [name, phase(tier, phaseOver)])),
    ...over,
  };
}

/** `base` with some of its phases replaced. */
export function withPhases(
  base: RecordedStep,
  patch: Readonly<Record<string, RecordedPhase>>,
): RecordedStep {
  return { ...base, phases: { ...base.phases, ...patch } };
}

/** One climb: ladder `ladder`, `renderer`, repeat `repeat`, the tiers of levels 1, 2, 4 ... */
export function climb(
  renderer: RecordedStep['renderer'],
  repeat: number,
  tiers: readonly Tier[],
  options: { ladder?: string; levels?: readonly number[]; failedRun?: boolean } = {},
): RecordedStep[] {
  const ladder = options.ladder ?? 'A';
  return tiers.map((tier, index) =>
    step(tier, options.levels?.[index] ?? 2 ** index, {
      renderer,
      ladder,
      repeat,
      step: index,
      ...(options.failedRun ? { failedRun: true as const } : {}),
    }),
  );
}

/** A campaign file holding `steps`, its other fields as a laptop run leaves them. */
export function campaign(
  steps: readonly RecordedStep[],
  over: Partial<CampaignResult> = {},
): CampaignResult {
  return {
    schema: 1,
    runId: 'mvw6sheh',
    startedAt: '2026-10-31T09:25:07.000Z',
    bench: {
      gitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      kitVersion: '0.23.0',
      vflowVersion: '2.7.0',
      build: 'production',
    },
    machine: {
      label: 'rig',
      ua: 'Mozilla/5.0 Chrome/156.0.0.0 Safari/537.36',
      cores: 8,
      deviceMemory: 32,
      dpr: 1,
      screen: { w: 1920, h: 1080 },
      viewport: { w: 1920, h: 1080 },
      refreshHz: 60,
      webgl: { vendor: 'Google Inc.', renderer: 'ANGLE (Intel)' },
    },
    config: {
      seed: 1,
      ladders: ['A'],
      renderers: ['kit', 'vflow'],
      repeats: 3,
      warmupMs: 3000,
      phases: PHASES.map((name) => ({ name, ms: 2000 })),
      input: 'page',
    },
    steps,
    warnings: [],
    measurement: {
      refresh: { measuredMs: 16.7, hz: 60, intervalMs: INTERVAL_MS },
      loaf: { source: 'long-animation-frame', lost: 0, limits: 'Long animation frames limits.' },
      build: 'buildMs runs from the input change to the first frame.',
    },
    notComparable: ['Hover dimming exists only in the kit.'],
    runs: [],
    harness: {
      node: 'v24.22.1',
      target: 'local',
      headless: false,
      viewport: { w: 1920, h: 1080 },
      dpr: '1',
      cooldownMs: 0,
      browserVersion: '156.0.8078.4',
      complete: true,
    },
    ...over,
  };
}
