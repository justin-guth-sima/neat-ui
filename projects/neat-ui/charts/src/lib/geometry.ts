import { scaleLinear } from 'd3-scale';
import { area, line } from 'd3-shape';
import type { NeatSeries } from './types';

/*
 * The geometry every chart in the entry shares. A chart's SVG has `viewBox="0 0 600 100"` and
 * `preserveAspectRatio="none"`, so the paths below are in that box: x from 0 (the oldest sample)
 * to 600 (the newest), y from 0 (the top of the domain) to 100 (its bottom). Nothing here touches
 * the DOM or measures anything.
 *
 * The functions are ported from Insight #170's `stats/dashboard.js` and `model.js`, with d3 doing
 * the path syntax; where #170 rounded by hand, d3's `digits` does.
 */

/** The width of the drawing box; a fraction of 1 is this far across. */
const WIDTH = 600;
/** The height of the drawing box. */
const HEIGHT = 100;
/** Decimals kept in a path: a hundredth of a pixel is far below what the eye sees. */
const DIGITS = 2;
/** From this many seconds, a span reads in minutes: "−119 s", then "−2 min". */
const MINUTES_FROM = 120;

/** Whether a sample is a number rather than `null`, `NaN` or an infinity: the one test every chart makes. */
export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** `length` positions from 0 to 1, evenly spaced; a single sample sits at 0. */
export function evenFractions(length: number): number[] {
  return Array.from({ length }, (_, index) => index / Math.max(1, length - 1));
}

/**
 * The times of `length` samples if every one has a time, none goes back and they do not all
 * fall at one instant; otherwise null, and the samples cannot be placed by time.
 */
export function orderedTimes(times: readonly (number | null)[], length: number): number[] | null {
  if (length < 2 || times.length !== length) return null;
  const ordered: number[] = [];
  for (const time of times) {
    if (!isNumber(time) || time < (ordered.at(-1) ?? -Infinity)) return null;
    ordered.push(time);
  }
  return ordered[length - 1] > ordered[0] ? ordered : null;
}

/**
 * Where each sample sits across the plot, 0 to 1. Samples are placed by their time (ms) when every
 * one has one, in order, so a delayed poll or a back-off shows as a gap; otherwise they are evenly
 * spaced.
 */
export function timeFractions(times: readonly (number | null)[], length: number): number[] {
  const ordered = orderedTimes(times, length);
  if (!ordered) return evenFractions(length);
  const start = ordered[0];
  const span = ordered[length - 1] - start;
  return ordered.map((time) => (time - start) / span);
}

/**
 * The sample nearest a pointer at `fraction` (0 to 1) of the plot's width, placed as `fractions`
 * places them (a tie goes to the later sample), or -1 when there are none. A `fractions` that does not cover `length` samples is
 * read as evenly spaced.
 */
export function indexAt(fraction: number, length: number, fractions: readonly number[]): number {
  if (!length) return -1;
  const at = fractions.length === length ? fractions : evenFractions(length);
  let nearest = 0;
  at.forEach((position, index) => {
    if (Math.abs(position - fraction) <= Math.abs(at[nearest] - fraction)) nearest = index;
  });
  return nearest;
}

/** A scale from the domain to the box's height, the top of the domain at 0; values beyond it clamp. */
function yScale(domain: readonly [number, number]) {
  return scaleLinear().domain(domain).range([HEIGHT, 0]).clamp(true);
}

/** Where a value sits in the box, from 0 (the top of the domain) to 100; values beyond it clamp. */
export function yAt(value: number, domain: readonly [number, number]): number {
  return round(yScale(domain)(value));
}

/**
 * The line and the filled area under it for one series, and the newest point (null unless the
 * newest sample exists). A missing sample breaks the line rather than dropping to zero, and a run
 * of one sample draws neither line nor area, as in #170: a lone sample is the newest-point dot's
 * to show, not the line's. `fractions` that do not cover `values` are read as evenly spaced.
 */
export function linePaths(
  values: readonly (number | null)[],
  fractions: readonly number[],
  domain: readonly [number, number],
): { line: string; area: string; last: { x: number; y: number } | null } {
  const y = yScale(domain);
  const at = fractions.length === values.length ? fractions : evenFractions(values.length);
  const x = (_: unknown, index: number) => at[index] * WIDTH;
  // A sample is drawn only beside another: d3 would draw a lone one as a closed point (a dot under
  // round caps) in the line and as a zero-width sliver in the area.
  const joined = (_: number | null, index: number) =>
    isNumber(values[index]) && (isNumber(values[index - 1]) || isNumber(values[index + 1]));

  const newest = values.at(-1);
  return {
    line:
      line<number | null>()
        .defined(joined)
        .x(x)
        .y((value) => y(value as number))
        .digits(DIGITS)(values) ?? '',
    area:
      area<number | null>()
        .defined(joined)
        .x(x)
        .y0(HEIGHT)
        .y1((value) => y(value as number))
        .digits(DIGITS)(values) ?? '',
    last: isNumber(newest)
      ? { x: round(at[values.length - 1] * WIDTH), y: round(y(newest)) }
      : null,
  };
}

function round(value: number): number {
  return Number(value.toFixed(DIGITS));
}

/**
 * The areas of a stack, the bottom band first, each as one path. A sample where any band is
 * missing breaks the whole stack: a partial sum would draw a total that was never measured. A run
 * of one sample draws no band. `fractions` that do not cover the longest list are read as evenly
 * spaced.
 */
export function stackedPaths(
  lists: readonly (readonly (number | null)[])[],
  fractions: readonly number[],
  domain: readonly [number, number],
): string[] {
  const y = yScale(domain);
  const length = Math.max(0, ...lists.map((list) => list.length));
  const at = fractions.length === length ? fractions : evenFractions(length);
  const complete = at.map((_, index) => lists.every((list) => isNumber(list[index])));
  const joined = (index: number) => complete[index] && (complete[index - 1] || complete[index + 1]);
  const top = at.map(() => 0);
  return lists.map((list) => {
    const bottom = top.slice();
    complete.forEach((whole, index) => {
      if (whole) top[index] += list[index] as number;
    });
    return (
      area<number>()
        .defined((_, index) => joined(index))
        .x((_, index) => at[index] * WIDTH)
        .y0((_, index) => y(bottom[index]))
        .y1((_, index) => y(top[index]))
        .digits(DIGITS)(top) ?? ''
    );
  });
}

/** Where the grid lines go: about three round values across the domain. */
export function gridTicks(domain: readonly [number, number]): number[] {
  return scaleLinear().domain(domain).ticks(3);
}

/** An axis value: few digits, thousands separated, no unit (the chart's format adds that). */
export function axisLabel(value: number): string {
  if (!isNumber(value)) return '';
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString('en-US');
  return String(Number(value.toFixed(value < 10 ? 1 : 0)));
}

/** A span in whole seconds up to two minutes, in whole minutes beyond: "45 s", "8 min". */
function duration(seconds: number): string {
  const whole = Math.round(seconds);
  return whole < MINUTES_FROM ? `${whole} s` : `${Math.round(seconds / 60)} min`;
}

/**
 * The time axis's label for a point `secondsBefore` the newest: "now", "−45 s" under a minute,
 * and whole minutes from one ("−2 min"): an axis label is read at a glance, not to the second.
 */
export function axisTimeLabel(secondsBefore: number): string {
  const whole = Math.round(secondsBefore);
  if (whole === 0) return 'now';
  return whole < 60 ? `−${whole} s` : `−${Math.round(secondsBefore / 60)} min`;
}

/**
 * The seconds from the oldest sample to the newest, or null when the times cannot place the
 * samples (the same test `timeFractions` applies).
 */
export function timeSpan(times: readonly (number | null)[], length: number): number | null {
  const ordered = orderedTimes(times, length);
  return ordered ? (ordered[length - 1] - ordered[0]) / 1000 : null;
}

/**
 * How much the chart shows: the span of the sample times ("8 min", "45 s"), or, when the times
 * cannot place the samples, how many there are.
 */
export function windowText(times: readonly (number | null)[], length: number): string {
  const span = timeSpan(times, length);
  if (span !== null) return duration(span);
  return `${length} ${length === 1 ? 'sample' : 'samples'}`;
}

/** The most series the palette tells apart: `--neat-series-1` to `-8`. */
const MAX_SERIES = 8;

/**
 * Up to eight series pass unchanged. Beyond that the seven with the largest mean (of the samples
 * they have; a series without any is the smallest) stay in their own order, and the rest sum into
 * a last series, "Other", whose sample is the sum of the folded numbers, or null where any of them
 * is missing: a partial sum would be a total that was never measured, which a stack must not draw.
 * Ties keep the series that comes first.
 */
export function foldSeries(series: readonly NeatSeries[]): NeatSeries[] {
  if (series.length <= MAX_SERIES) return [...series];
  const means = series.map((entry) => {
    const numbers = entry.values.filter(isNumber);
    return numbers.length
      ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length
      : -Infinity;
  });
  const kept = new Set(
    series
      .map((_, index) => index)
      .sort((a, b) => means[b] - means[a] || a - b)
      .slice(0, MAX_SERIES - 1),
  );
  const folded = series.filter((_, index) => !kept.has(index));
  const length = Math.max(...folded.map((entry) => entry.values.length));
  const sums = Array.from({ length }, (_, index) => {
    const values = folded.map((entry) => entry.values[index]);
    return values.every(isNumber) ? values.reduce((sum, value) => sum + value, 0) : null;
  });
  return [
    ...series.filter((_, index) => kept.has(index)),
    { key: 'other', label: 'Other', values: sums },
  ];
}
