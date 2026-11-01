import type { Capacity, Climb, TierGoal } from './analysis';

/*
 * The fallback rule (design open question 2, decided): the kit is clearly slower than ngx-vflow on
 * a machine where its capacity (the largest load that met the tier, `analysis.ts`) is at least one
 * doubling step below vflow's in at least 2 of 3 repeats. Pure.
 */

export const RULE = { needed: 2, of: 3 } as const;

/** The supporting evidence's bound (open question 2, option b). */
const EVIDENCE_RATIO = 0.85;

export type VerdictKind = 'slower' | 'not-slower' | 'neither' | 'inconclusive';

/** One repeat's kit and vflow climbs, side by side. */
export interface RepeatPair {
  readonly repeat: number;
  readonly kit: Capacity;
  readonly vflow: Capacity;
  readonly slower: boolean;
  /**
   * Whether the pair compares anything: vflow met the tier at some level. Where it met none, the
   * kit has nothing to be slower than, and nothing to be not slower than either.
   */
  readonly comparable: boolean;
  /** A page load of the pair did not finish: its capacity is what it reached before it died. */
  readonly failed: boolean;
}

export interface FallbackVerdict {
  readonly kind: VerdictKind;
  readonly goal: TierGoal;
  readonly pairs: readonly RepeatPair[];
  readonly slowerCount: number;
  /** The pairs in which vflow met the tier. */
  readonly comparableCount: number;
}

/**
 * Whether `kit` is a doubling step or more below `vflow`. A climb that never failed has no
 * capacity of its own to compare (it reached its cap), and a kit that cannot meet the first level
 * where vflow can is below by all of them. Levels are compared as numbers, not as steps of a
 * ladder, so a refined knee (a level between two steps) has to be a whole doubling below.
 */
export function isClearlySlower(kit: Capacity, vflow: Capacity): boolean {
  if (vflow.level === null || kit.atCap) return false;
  if (kit.level === null) return true;
  return kit.level < vflow.level && kit.level <= vflow.level / 2;
}

/**
 * The rule on one ladder, from the kit's and vflow's climbs: their repeats are paired by number.
 * With fewer than three repeats the verdict waits while the repeats still to come could change it:
 * it is `slower`, `not-slower` or `neither` only once the pairs run so far settle it.
 */
export function fallbackVerdict(
  kit: readonly Climb[],
  vflow: readonly Climb[],
  goal: TierGoal,
): FallbackVerdict {
  const vflowByRepeat = new Map(vflow.map((climb) => [climb.repeat, climb]));
  const pairs: RepeatPair[] = [];
  for (const k of [...kit].sort((a, b) => a.repeat - b.repeat)) {
    const v = vflowByRepeat.get(k.repeat);
    if (!v) continue;
    pairs.push({
      repeat: k.repeat,
      kit: k[goal],
      vflow: v[goal],
      slower: isClearlySlower(k[goal], v[goal]),
      comparable: v[goal].level !== null,
      failed: k.failed || v.failed,
    });
  }
  const slowerCount = pairs.filter((pair) => pair.slower).length;
  const comparableCount = pairs.filter((pair) => pair.comparable).length;
  // More repeats than the rule names scale it: two thirds of them.
  const total = Math.max(pairs.length, RULE.of);
  const needed = Math.ceil((RULE.needed * total) / RULE.of);
  let kind: VerdictKind = 'inconclusive';
  if (slowerCount >= needed) kind = 'slower';
  // Only pairs in which vflow met the tier can be slower. Where even all the repeats still to come
  // could not make `needed` of them, the rule has nothing to decide: "not slower" would be a
  // pass for a comparison that measured nothing.
  else if (total - (pairs.length - comparableCount) < needed) kind = 'neither';
  else if (slowerCount + (total - pairs.length) < needed) kind = 'not-slower';
  return { kind, goal, pairs, slowerCount, comparableCount };
}

/** A level's median fps for one renderer, as the supporting evidence reads it. */
interface LevelFps {
  readonly level: number;
  readonly fps: { readonly median: number };
}

export interface Evidence {
  /** The levels both renderers ran. */
  readonly compared: number;
  /** The kit was under 85 % of vflow's fps at two of them that follow each other. */
  readonly consecutive: boolean;
  readonly below: readonly {
    readonly level: number;
    readonly kitFps: number;
    readonly vflowFps: number;
    readonly ratio: number;
  }[];
}

/**
 * Open question 2's option (b), shown beside the rule and never in its place: at any level both
 * ran, the kit's median fps under 85 % of vflow's, at two consecutive levels. Where both are
 * pinned at the refresh rate, fps cannot tell them apart; the busy share in the tables can.
 */
export function supportingEvidence(kit: readonly LevelFps[], vflow: readonly LevelFps[]): Evidence {
  const vflowAt = new Map(vflow.map((cell) => [cell.level, cell.fps.median]));
  const shared = kit
    .filter((cell) => (vflowAt.get(cell.level) ?? 0) > 0)
    .sort((a, b) => a.level - b.level)
    .map((cell) => {
      const vflowFps = vflowAt.get(cell.level) as number;
      return {
        level: cell.level,
        kitFps: cell.fps.median,
        vflowFps,
        ratio: cell.fps.median / vflowFps,
      };
    });
  const isBelow = (row: { ratio: number }): boolean => row.ratio < EVIDENCE_RATIO;
  return {
    compared: shared.length,
    consecutive: shared.some((row, i) => i > 0 && isBelow(row) && isBelow(shared[i - 1])),
    below: shared.filter(isBelow),
  };
}
