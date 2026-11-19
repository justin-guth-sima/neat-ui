import type { NeatChartFormat, NeatSeries } from '@sima/neat-ui/charts';

/**
 * Eight minutes of MLA usage, a sample every four seconds, ending at a fixed instant so the demo
 * stands still.
 */
const SAMPLES = 120;

export const TIMES: readonly number[] = Array.from(
  { length: SAMPLES },
  (_, index) => Date.UTC(2026, 9, 24, 12, 0, 0) + index * 4000,
);

export const MLA_USAGE: readonly NeatSeries[] = [
  {
    key: 'mla',
    label: 'MLA',
    values: Array.from({ length: SAMPLES }, (_, index) =>
      Number((48 + 22 * Math.sin((index / SAMPLES) * 4 * Math.PI)).toFixed(1)),
    ),
  },
];

export const percent: NeatChartFormat = (value) => `${value.toFixed(0)}%`;
