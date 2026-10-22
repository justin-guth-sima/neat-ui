import { decodeRleMaskAlpha } from './rle';

// Alpha channel of the decoded RGBA buffer, as a row-major grid of 0/1.
function decodeToGrid(counts: number[], maskWidth: number, maskHeight: number): number[][] {
  const pixels = new Uint8ClampedArray(maskWidth * maskHeight * 4);
  decodeRleMaskAlpha(pixels, counts, maskWidth, maskHeight);

  const rows: number[][] = [];
  for (let y = 0; y < maskHeight; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < maskWidth; x += 1) {
      row.push(pixels[(y * maskWidth + x) * 4 + 3] === 255 ? 1 : 0);
    }
    rows.push(row);
  }
  return rows;
}

describe('decodeRleMaskAlpha', () => {
  it('decodes runs column-major with a leading background run', () => {
    // size [4, 3] counts [0, 6, 6]: six foreground pixels fill column 0 and the top of column 1.
    expect(decodeToGrid([0, 6, 6], 3, 4)).toStrictEqual([
      [1, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
      [1, 0, 0],
    ]);
  });

  it('does not transpose a non-square mask', () => {
    // A row-major decode would light the top row instead of the first column.
    expect(decodeToGrid([0, 4], 3, 4)).toStrictEqual([
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
    ]);

    // Seven runs of three over a 7x3 mask: every second column is foreground.
    expect(decodeToGrid([3, 3, 3, 3, 3, 3, 3], 7, 3)).toStrictEqual([
      [0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0],
    ]);
  });

  it('stops the decode at run lengths past the mask total', () => {
    const started = performance.now();
    const grid = decodeToGrid([0, 1e9], 3, 4);
    const elapsedMs = performance.now() - started;

    expect(grid).toStrictEqual([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(elapsedMs, `decode of a 1e9 run took ${elapsedMs.toFixed(1)} ms`).toBeLessThan(1000);
  });

  it('leaves the buffer untouched for counts that encode no foreground', () => {
    const blank = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];

    expect(decodeToGrid([], 3, 4)).toStrictEqual(blank);
    expect(decodeToGrid([12], 3, 4)).toStrictEqual(blank);
  });
});
