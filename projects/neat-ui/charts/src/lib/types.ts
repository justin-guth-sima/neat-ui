/**
 * What a time chart's x axis counts: `recent` back from the newest sample ("−8 min … now"), for a
 * live window, or `elapsed` forward from the first ("0 s … 33.9 s"), for a run read from its start.
 */
export type NeatChartAxis = 'recent' | 'elapsed';

/** How a chart draws its line: the default colour, or a threshold's. */
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
