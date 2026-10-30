import { isNumber, orderedTimes } from './geometry';

/*
 * How a heatmap row's samples fall into columns: at most 48 slices of the window, each the mean of
 * its samples, so the picture changes slowly rather than at every poll (about ten seconds a column
 * at Sentinel's two-second cadence). Ported from Insight #170's `stats/dashboard.js`, with times in
 * ms. Times that cannot place the samples (see `orderedTimes`) put them by count instead.
 *
 * Polls arrive with jitter, a few hundred ms either way, and a sample that lands in its
 * neighbour's column leaves an empty one behind, a gap the board never had. Three rules keep that
 * out while a real pause still shows: the sampling interval is the median gap, which one early
 * sample cannot shrink; a short history centres a column on each sampling instant, so a sample has
 * half an interval of slack either way; and an empty column inside a gap of at most two intervals,
 * one late or lost poll rather than a pause, shows its previous column.
 */

/** The most columns a heatmap row has. */
export const NEAT_HEATMAP_COLUMNS = 48;

/**
 * The samples each column shows, oldest column first, as indices oldest first: the one place that
 * assigns samples to columns, so the drawn cells (`columnMeans`) and the readout
 * (`newestInColumn`) cannot disagree. A jitter hole holds its previous column's array.
 */
function columnSamples(length: number, columns: number, times: number[] | null): number[][] {
  return times ? byTime(times, columns) : byCount(length, columns);
}

/** The samples spread over at most `columns` by their place in the list, as #170 did. */
function byCount(length: number, columns: number): number[][] {
  const count = Math.min(length, columns);
  const size = length / count;
  const samples: number[][] = Array.from({ length: count }, () => []);
  for (let index = 0; index < length; index += 1) {
    // The epsilon keeps a sample on a column's edge in the column it ends, despite float error.
    const column = Math.min(count - 1, Math.max(0, Math.ceil((index + 1) / size - 1e-9) - 1));
    samples[column].push(index);
  }
  return samples;
}

/**
 * The samples spread over at most `columns` by their times. A history with more sampling
 * instants (its span in intervals, plus one) than columns cuts its span into equal slots. A
 * shorter one gets one column per instant, so a pause in the samples stays an empty stretch
 * instead of closing up, each column centred on its instant, so a sample up to half an interval
 * early or late stays in its own column. `columns` may be the count an earlier call returned: a
 * short history's count is its number of instants and a long one's is below it, so the same
 * count gives the same layout.
 */
function byTime(times: number[], columns: number): number[][] {
  const start = times[0];
  const last = times.length - 1;
  const span = times[last] - start;
  const step = samplingInterval(times);
  const instants = Math.round(span / step) + 1;
  const count = Math.min(columns, instants);
  const centred = count === instants;
  const samples: number[][] = Array.from({ length: count }, () => []);
  times.forEach((time, index) => {
    const place = (time - start) / span;
    const column = centred
      ? Math.round(place * (count - 1))
      : Math.min(count - 1, Math.floor(place * count));
    samples[column].push(index);
  });
  // The first sample is always in column 0, so a hole always has a column before it to show.
  let after = 1;
  for (let column = 1; column < count; column += 1) {
    if (samples[column].length) continue;
    const centre = start + span * (centred ? column / (count - 1) : (column + 0.5) / count);
    while (after < last && times[after] < centre) after += 1;
    if (times[after] - times[after - 1] <= 2 * step) samples[column] = samples[column - 1];
  }
  return samples;
}

/**
 * The time between polls: the median of the positive gaps between samples, the lower middle one
 * for an even number. Not the smallest gap: one sample that arrives early would shrink it and add
 * columns that stay empty. A pause only ever lengthens a gap, hence the lower middle: of two
 * gaps, the shorter is the interval and the longer the pause.
 */
function samplingInterval(times: readonly number[]): number {
  const gaps: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    const gap = times[index] - times[index - 1];
    if (gap > 0) gaps.push(gap);
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor((gaps.length - 1) / 2)];
}

/**
 * A row's samples split into slices of time, at most `columns`, each the mean of the numbers in
 * it (null where it has none). `times` (ms, oldest first) place the samples; without usable times
 * they go by count.
 */
export function columnMeans(
  values: readonly (number | null)[],
  columns: number = NEAT_HEATMAP_COLUMNS,
  times: readonly (number | null)[] = [],
): (number | null)[] {
  const ordered = orderedTimes(times, values.length);
  return columnSamples(values.length, columns, ordered).map((indices) => {
    const numbers = indices.map((index) => values[index]).filter(isNumber);
    return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
  });
}

/**
 * The newest sample `column` shows, to say how long ago that slice was; -1 when it shows none.
 * `length` is the number of samples, `columns` the count `columnMeans` returned for them, and
 * `times` place them as they did there.
 */
export function newestInColumn(
  column: number,
  length: number,
  columns: number,
  times: readonly (number | null)[] = [],
): number {
  const ordered = orderedTimes(times, length);
  return columnSamples(length, columns, ordered)[column]?.at(-1) ?? -1;
}
