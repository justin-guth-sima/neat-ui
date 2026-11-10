/**
 * What a time chart's x axis counts: `recent` or `elapsed`.
 *
 * `recent` counts back from the newest sample ("−8 min … now"), for a live window. `elapsed`
 * counts forward from the first ("0 s … 33.9 s"), for a run read from its start.
 */
export type NeatChartAxis = 'recent' | 'elapsed';

/** How a chart draws its line: the default color, or a threshold's. */
export type NeatChartTone = 'default' | 'warning' | 'danger';

/** One line or band of a chart. A `null` is a sample that was not taken, which breaks the line. */
export interface NeatSeries {
  readonly key: string;
  readonly label: string;
  readonly values: readonly (number | null)[];
}

/** A level the chart marks as a warning or a danger. */
export interface NeatThreshold {
  readonly value: number;
  readonly tone: 'warning' | 'danger';
  readonly label: string;
}

/** A level the chart marks that is neither, such as a limit or a target. */
export interface NeatReference {
  readonly value: number;
  readonly label: string;
}

/** How a chart words a value: the app's unit and precision, which the charts know nothing of. */
export type NeatChartFormat = (value: number) => string;

/**
 * A sample of a time chart or a stacked chart that a click, or Enter, chose.
 *
 * It holds when the sample was taken, in ms as `times` has it, or null for a sample without a
 * time. It holds each line's or band's value there, by its key, with a ninth series and beyond as
 * "other".
 */
export interface NeatSamplePick {
  readonly time: number | null;
  readonly values: readonly { readonly key: string; readonly value: number | null }[];
}

/**
 * A heatmap cell as `hovered` names it: its row's `key`, and the time of the newest sample its
 * column shows (ms, as `times` has it).
 */
export interface NeatHeatmapCell {
  readonly row: string;
  readonly time: number;
}

/** A heatmap cell a click (or Enter) chose: its row, its time when `times` give one, and its mean. */
export interface NeatHeatmapPick {
  readonly row: string;
  readonly time: number | null;
  readonly value: number | null;
}

/** A click (or Enter) on a label timeline: the run under it, if any, and the moment (ms). */
export interface NeatRunPick {
  readonly run: { readonly label: string; readonly startMs: number; readonly endMs: number } | null;
  readonly time: number;
}
