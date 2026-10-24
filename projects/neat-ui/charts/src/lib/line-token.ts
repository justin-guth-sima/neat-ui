import type { NeatChartTone } from './types';

/**
 * The line colour of a tone: `--neat-line`, or `--neat-line-warning` and `--neat-line-danger`. The
 * one place the charts map a tone to a token, for a sparkline's stroke, a time chart's single
 * series and a threshold's line alike.
 */
export function lineToken(tone: NeatChartTone): string {
  return tone === 'default' ? 'var(--neat-line)' : `var(--neat-line-${tone})`;
}
