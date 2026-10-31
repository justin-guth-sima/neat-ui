import type { LoadStep } from '../hosts/bench-load';
import { D1, scaledParams } from '../synth/synth-diagram';
import {
  type LadderPlan,
  MEASURED_PHASES,
  type PhaseSpec,
  STOP_FPS,
  WARMUP_MS,
} from './step-machine';

/*
 * The load ladders (design 2.4): what each level of a ladder puts on the page. A level is a scale
 * (A, D), messages per second (B) or a number of notes (C); E is one level, held. Pure.
 */

export type LadderId = 'A' | 'B' | 'C' | 'D' | 'E';

interface Ladder {
  /** What the level counts, for the result and the page. */
  readonly varies: string;
  readonly levels: readonly number[];
  /** The load of a level; `seed` seeds the diagram and its messages alike. */
  readonly load: (level: number, seed: number) => LoadStep;
}

/** Ladder C's and D's base rate: the demo's order of magnitude (design 2.4). */
const BASE_MSGS_PER_SEC = 400;
const SOAK_MSGS_PER_SEC = 800;

const doubling = (from: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) => from * 2 ** i);

export const LADDERS: Readonly<Record<LadderId, Ladder>> = {
  A: {
    varies: 'diagram size, D1 × s',
    levels: doubling(1, 6),
    load: (s, seed) => ({
      params: scaledParams(D1, s),
      msgsPerSec: 0,
      profile: 'demo-like',
      seed,
    }),
  },
  B: {
    varies: 'messages per second',
    levels: doubling(50, 10),
    load: (msgsPerSec, seed) => ({ params: D1, msgsPerSec, profile: 'demo-like', seed }),
  },
  C: {
    varies: 'notes with live rate cards',
    levels: [0, 4, 8, 16, 32, 64, 128],
    load: (notes, seed) => ({
      params: { ...D1, notes: Math.round(notes) },
      msgsPerSec: BASE_MSGS_PER_SEC,
      profile: 'demo-like',
      seed,
    }),
  },
  D: {
    varies: 'size, messages and notes together, × s',
    levels: doubling(1, 5),
    load: (s, seed) => ({
      params: scaledParams(D1, s),
      msgsPerSec: BASE_MSGS_PER_SEC * s,
      profile: 'demo-like',
      seed,
    }),
  },
  E: {
    varies: 'nothing: one ten-minute step',
    levels: [1],
    load: (_, seed) => ({
      params: D1,
      msgsPerSec: SOAK_MSGS_PER_SEC,
      profile: 'demo-like',
      seed,
    }),
  },
};

/**
 * What `level` of ladder `id` puts on the page. Any level from 0 will do, not only the ladder's
 * own: the knee refinement bisects between two of them (its counts are rounded to whole ones).
 */
export function ladderStep(id: LadderId, level: number, seed: number): LoadStep {
  if (!(level >= 0) || !Number.isFinite(level)) {
    throw new RangeError(`ladder ${id} has no level ${level}`);
  }
  return LADDERS[id].load(level, seed);
}

/**
 * The soak's phases: ten minutes in one-minute parts, so that no phase holds more draws than the
 * dot probe's ring and its statistics stay a minute's each. They are told apart by name.
 */
const SOAK_PHASES: readonly PhaseSpec[] = Array.from({ length: 10 }, (_, i) => ({
  name: `soak-${i + 1}`,
  ms: 60_000,
}));

export interface PlanOptions {
  /** Climb only the first `steps` levels (the query string's `steps`). */
  readonly steps?: number;
  readonly refine?: boolean;
  readonly stopFps?: number;
}

/** The step machine's plan for ladder `id`: its levels (or their first `steps`) and phases. */
export function ladderPlan(id: LadderId, options: PlanOptions = {}): LadderPlan {
  const { levels } = LADDERS[id];
  const steps = options.steps ?? levels.length;
  if (!Number.isInteger(steps) || steps < 1 || steps > levels.length) {
    throw new RangeError(`ladder ${id} has ${levels.length} steps: asked for ${steps}`);
  }
  return {
    levels: levels.slice(0, steps),
    phases: id === 'E' ? SOAK_PHASES : MEASURED_PHASES,
    warmupMs: WARMUP_MS,
    refine: options.refine ?? false,
    stopFps: options.stopFps ?? STOP_FPS,
  };
}
