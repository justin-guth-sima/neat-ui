import {
  axisLabel,
  axisTimeLabel,
  foldSeries,
  gridTicks,
  indexAt,
  linePaths,
  stackedPaths,
  timeFractions,
  windowText,
} from './geometry';
import type { NeatSeries } from './types';

/** How many separate sub-paths a d3 path string draws: one `M` each. */
const segments = (path: string): number => (path.match(/M/g) ?? []).length;

const seconds = (...offsets: number[]): number[] => offsets.map((offset) => offset * 1000);

describe('linePaths', () => {
  // Ported from #170's "a missing sample breaks the line instead of dropping to zero", the line
  // half; the viewBox is 600 wide and 100 high, so a fraction of 1 is x = 600.
  it('a missing sample breaks the line instead of dropping to zero', () => {
    const even = timeFractions([], 4);
    const path = linePaths([50, null, 50, 100], even, [0, 100]);
    expect(segments(path.line)).toBe(2);
    expect(path.line).toBe('M0,50ZM400,50L600,0');
    expect(path.area, 'a lone point has a line start but no area').toBe(
      'M400,50L600,0L600,100L400,100Z',
    );
    expect(path.last).toEqual({ x: 600, y: 0 });
  });

  it('has no newest point when the newest sample is missing', () => {
    expect(linePaths([1, null], timeFractions([], 2), [0, 1]).last).toBeNull();
  });

  it('clamps values beyond the domain to it', () => {
    expect(linePaths([150], [0], [0, 100]).line).toBe('M0,0Z');
    expect(linePaths([-20, 150], [0, 1], [0, 100]).line).toBe('M0,100L600,0');
  });

  it('draws nothing for no samples', () => {
    expect(linePaths([], [], [0, 100])).toEqual({ line: '', area: '', last: null });
  });

  // Ported from #170's "samples sit where their timestamps put them, so a delayed poll or
  // back-off shows as a gap".
  it('places samples where their times put them, so a delayed poll shows as a gap', () => {
    const at = timeFractions(seconds(0, 2, 32), 3);
    expect(at.map((fraction) => Number(fraction.toFixed(4)))).toEqual([0, 0.0625, 1]);
    const path = linePaths([10, 20, 30], at, [0, 100]);
    expect(path.line).toBe('M0,90L37.5,80L600,70');
    expect(path.last).toEqual({ x: 600, y: 70 });
  });
});

describe('stackedPaths', () => {
  // Ported from #170's stacked half: the bottom band comes first, and a sample where any band is
  // missing breaks the whole stack.
  it('stacks the bottom band first and breaks the whole stack where any band is missing', () => {
    const lists = [
      [1, 1, 1, 1, 1],
      [2, 2, null, 2, 2],
    ];
    const bands = stackedPaths(lists, timeFractions([], 5), [0, 4]);
    expect(bands).toEqual([
      'M0,75L150,75L150,100L0,100ZM450,75L600,75L600,100L450,100Z',
      'M0,25L150,25L150,75L0,75ZM450,25L600,25L600,75L450,75Z',
    ]);
    expect(bands.map(segments)).toEqual([2, 2]);
  });

  it('places the bands by time as the line does', () => {
    const at = timeFractions(seconds(0, 2, 32), 3);
    expect(stackedPaths([[1, 1, 1]], at, [0, 2])).toEqual([
      'M0,50L37.5,50L600,50L600,100L37.5,100L0,100Z',
    ]);
  });

  it('draws no band for a run of one sample', () => {
    expect(stackedPaths([[1, null, 1]], timeFractions([], 3), [0, 2])).toEqual(['']);
  });

  it('draws nothing for no bands', () => {
    expect(stackedPaths([], [], [0, 1])).toEqual([]);
  });
});

describe('timeFractions', () => {
  it('places samples by their times when every one has a time, in order', () => {
    expect(timeFractions(seconds(100, 110, 140), 3)).toEqual([0, 0.25, 1]);
  });

  it('spaces samples evenly when a time is missing or out of order', () => {
    expect(timeFractions([0, null, 3000], 3)).toEqual([0, 0.5, 1]);
    expect(timeFractions(seconds(30, 0, 10), 3), 'out of order').toEqual([0, 0.5, 1]);
    expect(timeFractions(seconds(0, 2), 3), 'times that do not cover every sample').toEqual([
      0, 0.5, 1,
    ]);
    expect(timeFractions(seconds(5, 5, 5), 3), 'all at one instant').toEqual([0, 0.5, 1]);
  });

  it('puts a single sample at the start and none nowhere', () => {
    expect(timeFractions([1000], 1)).toEqual([0]);
    expect(timeFractions([], 0)).toEqual([]);
  });
});

describe('indexAt', () => {
  it('finds the sample nearest a pointer, evenly spaced', () => {
    const even = (length: number) => timeFractions([], length);
    expect([0, 0.5, 1.2].map((fraction) => indexAt(fraction, 240, even(240)))).toEqual([
      0, 120, 239,
    ]);
    expect(indexAt(0.5, 0, [])).toBe(-1);
  });

  it('finds it where the times put it, not where the index does', () => {
    const at = timeFractions(seconds(0, 2, 32), 3);
    expect(indexAt(0.7, 3, at), 'past the gap the nearest is the 32 s sample').toBe(2);
    expect(indexAt(0.05, 3, at)).toBe(1);
  });
});

describe('axes', () => {
  it('gridTicks gives about three round values across the domain', () => {
    expect(gridTicks([0, 100])).toEqual([0, 50, 100]);
    expect(gridTicks([40, 90])).toEqual([40, 60, 80]);
  });

  it('axisLabel shows few digits, separates thousands and leaves the unit out', () => {
    expect([0, 3.14159, 9.96, 42.4, 999.5, 1234.5, 1_000_000, NaN].map(axisLabel)).toEqual([
      '0',
      '3.1',
      '10',
      '42',
      '1000',
      '1,235',
      '1,000,000',
      '',
    ]);
  });

  it('axisTimeLabel reads now, −45 s and −4 min', () => {
    expect([0, 45, 119, 120, 240, 479.6].map(axisTimeLabel)).toEqual([
      'now',
      '−45 s',
      '−119 s',
      '−2 min',
      '−4 min',
      '−8 min',
    ]);
  });

  it('windowText says the span of the times, or how many samples without them', () => {
    expect(windowText(seconds(0, 240, 480), 3)).toBe('8 min');
    expect(windowText(seconds(0, 45), 2)).toBe('45 s');
    expect(windowText([0, null, 2000], 3)).toBe('3 samples');
    expect(windowText([], 1)).toBe('1 sample');
  });
});

describe('foldSeries', () => {
  const series = (count: number, values: (key: number) => (number | null)[]): NeatSeries[] =>
    Array.from({ length: count }, (_, key) => ({
      key: `s${key}`,
      label: `Series ${key}`,
      values: values(key),
    }));

  it('keeps eight series as they are and folds the smallest of nine or more into Other', () => {
    const eight = series(8, (key) => [key + 1]);
    expect(foldSeries(eight)).toEqual(eight);

    // s0 and s1 have the smallest means (1 and 2), so of nine, the folded are the smallest two.
    const nine = series(9, (key) => [key + 1]);
    const folded = foldSeries(nine);
    expect(folded.map((entry) => entry.key)).toEqual([
      's2',
      's3',
      's4',
      's5',
      's6',
      's7',
      's8',
      'other',
    ]);
    expect(folded.at(-1)).toEqual({ key: 'other', label: 'Other', values: [3] });
  });

  it('keeps the seven largest in their own order, whatever their order of size', () => {
    const means = [5, 1, 9, 3, 7, 2, 8, 4, 6];
    const folded = foldSeries(series(9, (key) => [means[key]]));
    expect(folded.map((entry) => entry.key)).toEqual([
      's0',
      's2',
      's3',
      's4',
      's6',
      's7',
      's8',
      'other',
    ]);
  });

  it('Other sums the folded values per sample and is null only where all of them are', () => {
    const lists: (number | null)[][] = [
      [null, 1, null],
      [null, 2, 4],
      ...Array.from({ length: 7 }, () => [100, 100, 100]),
    ];
    const other = foldSeries(series(9, (key) => lists[key])).at(-1);
    expect(other?.values).toEqual([null, 3, 4]);
  });

  it('judges a series by the mean of its numbers only, a series without any as the smallest', () => {
    const lists: (number | null)[][] = [
      [null, null],
      [10, null],
      ...Array.from({ length: 7 }, () => [5, 5]),
    ];
    const folded = foldSeries(series(9, (key) => lists[key]));
    // s0 has no numbers and is folded; s1's mean is 10 (not 5), so it stays.
    expect(folded.map((entry) => entry.key)).toContain('s1');
    expect(folded.map((entry) => entry.key)).not.toContain('s0');
    expect(folded).toHaveLength(8);
  });
});
