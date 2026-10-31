// What the harness runs and in which order (design 2.4, "Repeats"), and the address each page
// load gets. Pure.

/**
 * The renderer order of one repeat: forward on even repeats, reversed on odd ones, so over three
 * repeats of two renderers it is K V, V K, K V and neither is always the one that follows a
 * cool-down or the one that runs on a warmer board.
 */
export function runOrder(renderers, repeat) {
  return repeat % 2 === 0 ? [...renderers] : [...renderers].reverse();
}

const SOAK_REASON =
  'ladder E, the soak, runs on the kit only: ten minutes of a comparison nobody asked for';

/**
 * Every page load of the campaign, in order: each ladder in turn, its repeats in turn, each
 * repeat's renderers alternating. A fresh page load is made for each, so no heap carries over.
 * What was left out is returned with the reason, to be printed and written into the result.
 */
export function buildSchedule({ ladders, renderers, repeats }) {
  const runs = [];
  const skipped = [];
  for (const ladder of ladders) {
    const allowed = ladder === 'E' ? renderers.filter((renderer) => renderer === 'kit') : renderers;
    for (const renderer of renderers) {
      if (!allowed.includes(renderer)) skipped.push({ ladder, renderer, reason: SOAK_REASON });
    }
    for (let repeat = 0; repeat < repeats; repeat++) {
      for (const renderer of runOrder(allowed, repeat)) runs.push({ ladder, renderer, repeat });
    }
  }
  return { runs, skipped };
}

/** The traced runs (design 1.4): one per renderer and ladder, separate from the measured ones. */
export function traceSchedule({ ladders, renderers }) {
  return ladders.flatMap((ladder) =>
    renderers
      .filter((renderer) => ladder !== 'E' || renderer === 'kit')
      .map((renderer) => ({ ladder, renderer, repeat: 0 })),
  );
}

/** The page's address for one run: the automatic mode's query (`auto-params.ts` reads it). */
export function pageUrl(base, { host, ladder, seed, steps, machine, refine, input, repeat }) {
  const url = new URL(base);
  const query = url.searchParams;
  query.set('auto', '1');
  query.set('host', host);
  query.set('ladder', ladder);
  query.set('seed', String(seed));
  if (steps !== undefined) query.set('steps', String(steps));
  query.set('machine', machine);
  if (refine) query.set('refine', '1');
  query.set('input', input);
  query.set('repeat', String(repeat));
  return url.toString();
}
