import { isNumber, orderedTimes } from './geometry';

/*
 * How a heatmap row's samples fall into columns: at most 48 slices of the window, each the mean of
 * its samples, so the picture changes slowly rather than at every poll (about ten seconds a column
 * at Sentinel's two-second cadence). Ported from Insight #170's `stats/dashboard.js`, with times in
 * ms. Times that cannot place the samples (see `orderedTimes`) put them by count instead.
 */

/** The most columns a heatmap row has. */
export const NEAT_HEATMAP_COLUMNS = 48;

/** The column of sample `index` among `length`, spread over `columns` by time, else by count. */
function columnOf(index: number, length: number, columns: number, times: number[] | null): number {
  if (times) {
    const span = times[length - 1] - times[0];
    return Math.min(columns - 1, Math.floor(((times[index] - times[0]) / span) * columns));
  }
  if (length <= columns) return index;
  const size = length / columns;
  // The epsilon keeps a sample on a column's edge in the column it ends, whatever float error says.
  return Math.min(columns - 1, Math.max(0, Math.ceil((index + 1) / size - 1e-9) - 1));
}

/**
 * How many columns a history fills. A long one fills them all. A short one with times gets one
 * column per sampling interval (its smallest gap), so a pause in the samples stays an empty
 * stretch instead of closing up.
 */
function columnCount(length: number, columns: number, times: number[] | null): number {
  if (length > columns) return columns;
  if (!times) return length;
  const span = times[length - 1] - times[0];
  let step = Infinity;
  for (let index = 1; index < length; index += 1) {
    const gap = times[index] - times[index - 1];
    if (gap > 0) step = Math.min(step, gap);
  }
  return Math.min(columns, Math.round(span / step) + 1);
}

/**
 * A row's samples split into equal slices of time, at most `columns`, each the mean of the
 * numbers in it (null where it has none). `times` (ms, oldest first) place the samples; without
 * usable times they go by count.
 */
export function columnMeans(
  values: readonly (number | null)[],
  columns: number = NEAT_HEATMAP_COLUMNS,
  times: readonly (number | null)[] = [],
): (number | null)[] {
  if (!values.length) return [];
  const ordered = orderedTimes(times, values.length);
  const count = columnCount(values.length, columns, ordered);
  const slices: number[][] = Array.from({ length: count }, () => []);
  values.forEach((value, index) => {
    if (isNumber(value)) slices[columnOf(index, values.length, count, ordered)].push(value);
  });
  return slices.map((slice) =>
    slice.length ? slice.reduce((sum, value) => sum + value, 0) / slice.length : null,
  );
}

/**
 * The newest sample in `column` of `columns`, to say how long ago that slice was; -1 when it holds
 * none. `length` is the number of samples, and `times` place them as they did for `columnMeans`.
 */
export function newestInColumn(
  column: number,
  length: number,
  columns: number,
  times: readonly (number | null)[] = [],
): number {
  const ordered = orderedTimes(times, length);
  for (let index = length - 1; index >= 0; index -= 1) {
    if (columnOf(index, length, columns, ordered) === column) return index;
  }
  return -1;
}
