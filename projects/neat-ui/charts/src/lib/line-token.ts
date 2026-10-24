import type { NeatChartTone } from './types';

/**
 * The line colour of a tone: `--neat-line`, or `--neat-line-warning` and `--neat-line-danger`. The
 * one place the charts map a tone to a token, for a sparkline's stroke, a time chart's single
 * series and a threshold's line alike.
 */
export function lineToken(tone: NeatChartTone): string {
  return tone === 'default' ? 'var(--neat-line)' : `var(--neat-line-${tone})`;
}

/**
 * The colour of text that carries a tone. `--neat-line` is line strength (3:1), too faint for text,
 * so the default tone is the foreground; the warning and danger line tokens reach 4.5:1 on the
 * surfaces (pinned in the theme spec), so they stay.
 */
export function textToken(tone: NeatChartTone): string {
  return tone === 'default' ? 'var(--foreground)' : lineToken(tone);
}

/** The palette colour of the series at `index` (from 0): `--neat-series-1` to `-8`. */
export function seriesToken(index: number): string {
  return `var(--neat-series-${index + 1})`;
}
