/*
 * How fast a picture being read shows its tiles. The real wait for the first word is not known in
 * advance, so the reading sweeps at the rate of the mockup it was chosen from (all tiles in 1.3 s,
 * the usual 0.4 to 1.3 s wait), rests a moment on the whole picture, and sweeps again for as long
 * as the board still reads, so it never stands still unfinished. Once the first word comes, the
 * round it is in finishes quickly and no other starts. Internal.
 */

/** How long the sweep takes for all tiles. */
export const SWEEP_MS = 1300;
/** How long a round rests on the whole picture before the next sweep. */
export const REST_MS = 500;
/** How long a round takes while the first word is not there. */
export const ROUND_MS = SWEEP_MS + REST_MS;
/** How long what is left of the round takes once the first word came. */
export const FINISH_MS = 300;

/** Which round of a reading it is, from 0, and how many of its tiles are revealed. */
export interface ReadingMoment {
  readonly round: number;
  readonly shown: number;
}

/**
 * The round, and how many of `total` tiles it has revealed, at `now`, for a reading that began at
 * `startedAt` and whose reply's first word came at `answeredAt` (null while it waits).
 */
export function readingAt(
  total: number,
  startedAt: number,
  answeredAt: number | null,
  now: number,
): ReadingMoment {
  const waiting = (at: number): ReadingMoment => {
    const elapsed = Math.max(0, at - startedAt);
    const round = Math.floor(elapsed / ROUND_MS);
    const into = elapsed - round * ROUND_MS;
    return { round, shown: Math.min(total, Math.round((into / SWEEP_MS) * total)) };
  };
  if (answeredAt === null || now < answeredAt) return waiting(now);
  const before = waiting(answeredAt);
  const share = Math.min(1, (now - answeredAt) / FINISH_MS);
  return { round: before.round, shown: before.shown + Math.round((total - before.shown) * share) };
}
