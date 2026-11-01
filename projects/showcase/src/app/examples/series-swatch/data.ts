import type { NeatChartFormat, NeatSeries } from '@sima/neat-ui/charts';

/** A sine wave of `count` samples: a plausible, smooth metric. */
function sine(count: number, cycles: number, low: number, high: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const wave = (Math.sin((index / count) * cycles * 2 * Math.PI) + 1) / 2;
    return Number((low + wave * (high - low)).toFixed(2));
  });
}

/**
 * Eight minutes of samples four seconds apart, ending at a fixed instant so the demo stands
 * still.
 */
const SAMPLES = 120;
export const TIMES: readonly number[] = Array.from(
  { length: SAMPLES },
  (_, index) => Date.UTC(2026, 9, 24, 12, 0, 0) + index * 4000,
);

export const percent: NeatChartFormat = (value) => `${value.toFixed(0)}%`;

/** Three runs of the same measurement, compared on one chart. */
export const RUNS: readonly NeatSeries[] = [
  { key: 'a', label: 'Run A', values: sine(SAMPLES, 2, 30, 70) },
  { key: 'b', label: 'Run B', values: sine(SAMPLES, 3, 10, 50) },
  { key: 'c', label: 'Run C', values: sine(SAMPLES, 1.5, 40, 90) },
];
