import type {
  NeatChartFormat,
  NeatReference,
  NeatSeries,
  NeatThreshold,
} from '@sima/neat-ui/charts';

/** A sine wave of `count` samples, the demo data of every chart: a plausible, smooth metric. */
export function sine(count: number, cycles: number, low: number, high: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const wave = (Math.sin((index / count) * cycles * 2 * Math.PI) + 1) / 2;
    return Number((low + wave * (high - low)).toFixed(2));
  });
}

/** The same with `gap` samples missing from `from`: a daemon that did not answer for a while. */
export function withGap(values: number[], from: number, gap: number): (number | null)[] {
  return values.map((value, index) => (index >= from && index < from + gap ? null : value));
}

/**
 * Eight minutes of samples four seconds apart, ending at a fixed instant so the demo stands
 * still.
 */
export const SAMPLES = 120;
export const TIMES: readonly number[] = Array.from(
  { length: SAMPLES },
  (_, index) => Date.UTC(2026, 9, 24, 12, 0, 0) + index * 4000,
);

export const percent: NeatChartFormat = (value) => `${value.toFixed(0)}%`;
export const celsius: NeatChartFormat = (value) => `${value.toFixed(1)} °C`;
export const watts: NeatChartFormat = (value) => `${value.toFixed(1)} W`;

export const CPU: readonly NeatSeries[] = [
  { key: 'cpu', label: 'CPU', values: sine(SAMPLES, 3, 20, 62) },
];
export const CPU_THRESHOLDS: readonly NeatThreshold[] = [
  { value: 70, tone: 'warning', label: 'Warning 70%' },
  { value: 90, tone: 'danger', label: 'Critical 90%' },
];

export const TEMPERATURE: readonly NeatSeries[] = [
  { key: 'mla', label: 'MLA', values: withGap(sine(SAMPLES, 2, 62, 80), 50, 14) },
];
export const TEMPERATURE_THRESHOLDS: readonly NeatThreshold[] = [
  { value: 70, tone: 'warning', label: 'Warning 70 °C' },
  { value: 85, tone: 'danger', label: 'Critical 85 °C' },
];

export const CLUSTERS: readonly NeatSeries[] = [
  { key: 'a', label: 'Cluster A', values: sine(SAMPLES, 2, 30, 70) },
  { key: 'b', label: 'Cluster B', values: sine(SAMPLES, 3, 10, 50) },
  { key: 'c', label: 'Cluster C', values: sine(SAMPLES, 1.5, 40, 90) },
];

export const CORES: readonly NeatSeries[] = Array.from({ length: 10 }, (_, index) => ({
  key: `core${index}`,
  label: `Core ${index}`,
  values: sine(SAMPLES, 1 + index / 4, 5 + index * 3, 25 + index * 6),
}));

export const MLA: readonly NeatSeries[] = [
  { key: 'mla', label: 'MLA', values: sine(SAMPLES, 3, 30, 90) },
];

export const POWER: readonly NeatSeries[] = [
  { key: 'power', label: 'Power', values: sine(SAMPLES, 2.5, 8, 13) },
];
export const POWER_AVERAGE: NeatReference = { value: 10.5, label: 'Session average 10.5 W' };

/** A list of metrics, one compact chart a row: two that fill the window and one just started. */
export const ROWS = [
  {
    label: 'Core 0',
    series: [{ key: 'core0', label: 'Core 0', values: sine(SAMPLES, 2, 20, 60) }],
    times: TIMES,
    value: '42%',
  },
  {
    label: 'Core 1',
    series: [{ key: 'core1', label: 'Core 1', values: sine(SAMPLES, 3, 30, 70) }],
    times: TIMES,
    value: '57%',
  },
  {
    label: 'One sample',
    series: [{ key: 'lone', label: 'One sample', values: [48] }],
    times: [TIMES[0]],
    value: '48%',
  },
] satisfies readonly {
  label: string;
  series: readonly NeatSeries[];
  times: readonly number[];
  value: string;
}[];
