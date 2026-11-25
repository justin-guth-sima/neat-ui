/*
 * How fast a picture being read shows its tiles. The real wait for the first word is not known in
 * advance, so the reading sweeps at the rate of the mockup it was chosen from (all tiles in 1.3 s,
 * the usual 0.4 to 1.3 s wait), holds the last tenth until the first word, so it never looks done
 * while the board still reads, and finishes what is left quickly once the word comes. Internal.
 */

/** How long the sweep takes for all tiles. */
export const SWEEP_MS = 1300;
/** The share of the tiles the sweep reveals before the first word. */
export const HOLD_SHARE = 0.9;
/** How long what is left takes once the first word came. */
export const FINISH_MS = 300;

/**
 * How many of `total` tiles are revealed at `now`, for a reading that began at `startedAt` and
 * whose reply's first word came at `answeredAt` (null while it waits).
 */
export function revealed(
  total: number,
  startedAt: number,
  answeredAt: number | null,
  now: number,
): number {
  const swept = (at: number) =>
    Math.min(Math.floor(total * HOLD_SHARE), Math.round(((at - startedAt) / SWEEP_MS) * total));
  if (answeredAt === null || now < answeredAt) return Math.max(0, swept(now));
  const before = Math.max(0, swept(answeredAt));
  const share = Math.min(1, (now - answeredAt) / FINISH_MS);
  return before + Math.round((total - before) * share);
}
