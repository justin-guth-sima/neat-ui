import type { NeatChartFormat, NeatHeatmapRow } from '@sima/neat-ui/charts';

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
/** The samples of the last minute, which the figure at a row's end averages. */
const LAST_MINUTE = 15;
export const TIMES: readonly number[] = Array.from(
  { length: SAMPLES },
  (_, index) => Date.UTC(2026, 9, 24, 12, 0, 0) + index * 4000,
);

export const percent: NeatChartFormat = (value) => `${value.toFixed(0)}%`;

/**
 * Sixteen cores: some idle, some busy, the last one saturated. The figure at a row's end is the
 * last minute's mean, in the warning colour from 70% and the danger colour from 85%.
 */
export const CORES: readonly NeatHeatmapRow[] = Array.from({ length: 16 }, (_, index) => {
  const values =
    index === 15
      ? sine(SAMPLES, 2, 88, 99)
      : sine(SAMPLES, 1 + index / 5, 5 + index * 2, 35 + index * 4);
  const recent = values.slice(-LAST_MINUTE).reduce((sum, value) => sum + value, 0) / LAST_MINUTE;
  return {
    key: `core${index}`,
    label: `Core ${index}`,
    values,
    end: percent(recent),
    endTone: recent >= 85 ? 'danger' : recent >= 70 ? 'warning' : 'default',
  };
});
