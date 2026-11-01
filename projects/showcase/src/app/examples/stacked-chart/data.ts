import type { NeatChartFormat, NeatSeries } from '@sima/neat-ui/charts';

/** A sine wave of `count` samples: a plausible, smooth metric. */
function sine(count: number, cycles: number, low: number, high: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const wave = (Math.sin((index / count) * cycles * 2 * Math.PI) + 1) / 2;
    return Number((low + wave * (high - low)).toFixed(2));
  });
}

/** The same with `gap` samples missing from `from`: a rail the board did not report for a while. */
function withGap(values: number[], from: number, gap: number): (number | null)[] {
  return values.map((value, index) => (index >= from && index < from + gap ? null : value));
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

export const watts: NeatChartFormat = (value) => `${value.toFixed(1)} W`;

/** Eight rails that sum to about 11 W: the stacked chart uses all eight series colours. */
export const RAILS: readonly NeatSeries[] = [
  { key: 'core', label: 'Core', low: 3.2, high: 4.6 },
  { key: 'mla', label: 'MLA', low: 1.5, high: 3.4 },
  { key: 'ddr', label: 'DDR', low: 1.2, high: 1.9 },
  { key: 'cam', label: 'Camera', low: 0.6, high: 1.1 },
  { key: 'net', label: 'Network', low: 0.4, high: 0.9 },
  { key: 'sto', label: 'Storage', low: 0.3, high: 0.6 },
  { key: 'fan', label: 'Fan', low: 0.2, high: 0.5 },
  { key: 'board', label: 'Board', low: 0.5, high: 0.7 },
].map(({ key, label, low, high }, index) => {
  const values = sine(SAMPLES, 1.5 + index / 3, low, high);
  // DDR does not report for a minute, which breaks the stack there.
  return { key, label, values: index === 2 ? withGap(values, 40, 15) : values };
});
