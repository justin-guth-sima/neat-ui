import { columnMeans, NEAT_HEATMAP_COLUMNS, newestInColumn } from './heatmap-columns';

/** Times in ms for samples taken at these many seconds after an arbitrary start. */
const at = (...offsets: number[]): number[] =>
  offsets.map((second) => Date.UTC(2026, 8, 25, 0, 0, 0) + second * 1000);

describe('the heatmap columns', () => {
  it('has 48 columns', () => {
    expect(NEAT_HEATMAP_COLUMNS).toBe(48);
  });

  it('average the samples of their slice of the window, so noise reads flat', () => {
    const noisy = Array.from({ length: 240 }, (_, index) => [30, 70, 40, 60, 50][index % 5]);
    const cells = columnMeans(noisy);
    expect(cells).toHaveLength(NEAT_HEATMAP_COLUMNS);
    expect(cells.every((value) => value === 50)).toBe(true);
  });

  it('give fewer samples than columns one column each, a missing sample leaving its column empty', () => {
    expect(columnMeans([1, null, 3])).toEqual([1, null, 3]);
    expect(columnMeans([])).toEqual([]);
  });

  it('follow board time when polling is uneven: a gap stays an empty stretch', () => {
    // 40 samples two seconds apart at 100%, then a back-off: 20 samples at 10% within the last 30 s.
    const times = [
      ...Array.from({ length: 40 }, (_, index) => at(index * 2)[0]),
      ...Array.from({ length: 20 }, (_, index) => at(600 + index * 1.5)[0]),
    ];
    const values = [...new Array<number>(40).fill(100), ...new Array<number>(20).fill(10)];
    expect(columnMeans(values, 4, times)).toEqual([100, null, null, 10]);
    expect([0, 1, 3].map((column) => newestInColumn(column, 60, 4, times))).toEqual([39, -1, 59]);
  });

  it('go by count, as #170 did, without usable times', () => {
    expect(columnMeans([1, 2, 3, 4, 5, 6], 4)).toEqual([1, 2.5, 4, 5.5]);
    expect([0, 1, 2, 3].map((column) => newestInColumn(column, 6, 4))).toEqual([0, 2, 3, 5]);
    // Times that do not cover every sample, or go back, cannot place them.
    expect(columnMeans([1, 2, 3, 4, 5, 6], 4, at(0, 1, 2))).toEqual([1, 2.5, 4, 5.5]);
    expect(columnMeans([1, 2, 3, 4, 5, 6], 4, at(0, 1, 2, 3, 5, 4))).toEqual([1, 2.5, 4, 5.5]);
  });

  it('a short history gets one column per sampling interval, so a pause stays visible', () => {
    const times = at(0, 2, 32);
    const paused = columnMeans([10, 20, 90], NEAT_HEATMAP_COLUMNS, times);
    expect(paused).toHaveLength(17);
    expect([paused[0], paused[1], paused[2], paused[15], paused[16]]).toEqual([
      10,
      20,
      null,
      null,
      90,
    ]);
    expect([0, 1, 2, 16].map((column) => newestInColumn(column, 3, paused.length, times))).toEqual([
      0, 1, -1, 2,
    ]);
    // Sampled evenly, the columns stay adjacent.
    expect(columnMeans([1, 2, 3], NEAT_HEATMAP_COLUMNS, at(0, 2, 4))).toEqual([1, 2, 3]);
  });
});
