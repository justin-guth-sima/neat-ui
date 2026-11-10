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

  /** Seconds `0 … count - 1`, one a second, with sample `shifted` moved by `by` seconds. */
  const everySecond = (count: number, shifted = -1, by = 0): number[] =>
    at(...Array.from({ length: count }, (_, index) => index + (index === shifted ? by : 0)));
  /** The row of `count` samples whose value is its index, so every column's mean is its own. */
  const indices = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

  it('no empty column when one sample of a short 1 Hz history arrives early or late', () => {
    for (const by of [-0.3, 0.3]) {
      for (let shifted = 1; shifted <= 28; shifted += 1) {
        const means = columnMeans(indices(30), NEAT_HEATMAP_COLUMNS, everySecond(30, shifted, by));
        expect(means, `sample ${shifted} moved by ${by} s`).toHaveLength(30);
        expect(means.includes(null), `sample ${shifted} moved by ${by} s`).toBe(false);
      }
    }
  });

  it('no empty column when one sample of a slotted 1 Hz history arrives late', () => {
    for (let shifted = 1; shifted <= 58; shifted += 1) {
      const means = columnMeans(indices(60), NEAT_HEATMAP_COLUMNS, everySecond(60, shifted, 0.3));
      expect(means, `sample ${shifted} late`).toHaveLength(48);
      expect(means.includes(null), `sample ${shifted} late`).toBe(false);
    }
  });

  it('a pause stays empty in a short history', () => {
    const offsets = [...indices(10), ...indices(10).map((second) => second + 15)];
    const means = columnMeans(indices(20), NEAT_HEATMAP_COLUMNS, at(...offsets));
    expect(means).toHaveLength(25);
    means.forEach((mean, column) => {
      const paused = column >= 10 && column <= 14;
      expect(mean === null, `column ${column}`).toBe(paused);
    });
  });

  it('a pause stays empty in a slotted history', () => {
    // Every two seconds over 480 s, none in 200–240 s: 48 slots of ten seconds, 20 to 23 inside it.
    const offsets = indices(241)
      .map((index) => index * 2)
      .filter((second) => second < 200 || second > 240);
    const means = columnMeans(offsets, NEAT_HEATMAP_COLUMNS, at(...offsets));
    expect(means).toHaveLength(48);
    means.forEach((mean, column) => {
      const paused = column >= 20 && column <= 23;
      expect(mean === null, `column ${column}`).toBe(paused);
    });
  });

  it("the readout of a filled hole names the previous column's sample", () => {
    // Sample 28 a third of a second late left slot 22 empty in 0.19.1.
    const times = everySecond(60, 28, 0.3);
    const means = columnMeans(indices(60), NEAT_HEATMAP_COLUMNS, times);
    expect(means[22]).toBe(means[21]);
    expect(newestInColumn(22, 60, means.length, times)).toBe(
      newestInColumn(21, 60, means.length, times),
    );
    expect(newestInColumn(21, 60, means.length, times)).toBeGreaterThanOrEqual(0);
  });

  it('reads out what it draws when the history has exactly as many instants as columns', () => {
    // 48 instants fill the 48 columns centered, the layout the readout derives from the count.
    const times = everySecond(48, 20, 0.6);
    const means = columnMeans(indices(48), NEAT_HEATMAP_COLUMNS, times);
    expect(means).toHaveLength(48);
    expect(means.slice(19, 22)).toEqual([19, 19, 20.5]);
    expect([19, 20, 21].map((column) => newestInColumn(column, 48, 48, times))).toEqual([
      19, 19, 21,
    ]);
  });
});
