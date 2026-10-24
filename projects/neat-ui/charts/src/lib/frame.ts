import { axisLabel, axisTimeLabel, gridTicks, timeSpan, windowText, yAt } from './geometry';

/*
 * What a plot's frame is made of, which the time chart and the stacked chart share: how tall it
 * is, its grid, its time axis and its accessible name.
 */

/** The plot's height in rem by size, set as `--plot-height` so the labels' room is worked out from it. */
export const PLOT_REM = { compact: 3.5, medium: 6, large: 9.5 } as const;

/** A label whose line is within this much of the top (in the box's 0 to 100) sits below the line. */
export const FLIP_BELOW = 14;

/** A label's height (the `.tag`'s text-xs line) and its gap to its line, in rem. */
const LABEL_REM = 0.75;
const LABEL_GAP_REM = 0.125;

/** A stretch of the box, from its top to its bottom in the box's 0 to 100. */
export type LabelSpan = readonly [number, number];

/**
 * The stretch of the box a label on the line at `y` takes in a plot of `size`: above its line, or
 * below it near the top (`FLIP_BELOW`), as `plot.css` places the `.tag`.
 */
export function labelSpan(y: number, size: keyof typeof PLOT_REM): LabelSpan {
  const unit = 100 / PLOT_REM[size];
  const [height, gap] = [LABEL_REM * unit, LABEL_GAP_REM * unit];
  return y < FLIP_BELOW ? [y + gap, y + gap + height] : [y - gap - height, y - gap];
}

const overlap = ([top, bottom]: LabelSpan, [from, to]: LabelSpan): boolean =>
  top < to && from < bottom;

/**
 * The grid marks whose labels have room, from the bottom of the domain up: none that would sit on
 * a label in `taken` (a level's, which says more), nor on the grid label kept below it (near the
 * top, where the top label flips below its line, the two would print one over the other). Every
 * grid line stays; only labels are left out.
 */
export function roomyGridMarks(
  marks: readonly GridMark[],
  size: keyof typeof PLOT_REM,
  taken: readonly LabelSpan[] = [],
): GridMark[] {
  const kept: GridMark[] = [];
  let below: LabelSpan | null = null;
  for (const mark of marks) {
    const span = labelSpan(mark.y, size);
    if (taken.some((other) => overlap(span, other))) continue;
    if (below && overlap(span, below)) continue;
    kept.push(mark);
    below = span;
  }
  return kept;
}

/** A grid line across the plot with its label: `y` is 0 (the top of the domain) to 100. */
export interface GridMark {
  readonly value: number;
  readonly y: number;
  readonly text: string;
}

export function gridMarks(domain: readonly [number, number]): GridMark[] {
  return gridTicks(domain).map((value) => ({
    value,
    y: yAt(value, domain),
    text: axisLabel(value),
  }));
}

/** The time axis: the start, middle and end of the span, or only "now" without a span. */
export function timeAxis(
  times: readonly (number | null)[],
  length: number,
): { at: number; text: string }[] {
  if (!length) return [];
  const span = timeSpan(times, length);
  // Without a span there is nothing to count back from; the newest sample sits at the end,
  // except a lone one, which sits at the start.
  if (span === null) return [{ at: length > 1 ? 1 : 0, text: axisTimeLabel(0) }];
  return [0, 0.5, 1].map((at) => ({ at, text: axisTimeLabel(span * (1 - at)) }));
}

/** A chart's accessible name: "<label>: <current>, over the last <window>". */
export function chartName(
  label: string,
  current: string,
  times: readonly (number | null)[],
  length: number,
): string {
  return `${label}${current ? `: ${current}` : ''}, over the last ${windowText(times, length)}`;
}
