import { fitAllTileWidth, NeatTileAspect, packTiles } from './pack';

describe('packTiles', () => {
  it('packs 16:9 tiles: 1920×1000 area, width 300, gap 8 → 6 columns × 5 rows', () => {
    // Tile height is 168.75, so a row takes 176.75 with the gap: floor(1008 / 176.75) = 5.
    expect(packTiles({ width: 1920, height: 1000 }, 300, '16:9', 8)).toEqual({
      columns: 6,
      rows: 5,
      perPage: 30,
      tileWidth: 300,
      tileHeight: 168.75,
    });
  });

  it('square tiles use height = width', () => {
    expect(packTiles({ width: 1920, height: 1000 }, 300, '1:1', 8)).toEqual({
      columns: 6,
      rows: 3,
      perPage: 18,
      tileWidth: 300,
      tileHeight: 300,
    });
  });

  it('counts the gap only between tiles, not after the last one', () => {
    // Exactly three 100 px tiles and two 10 px gaps.
    expect(packTiles({ width: 320, height: 56.25 }, 100, '16:9', 10).columns).toBe(3);
    expect(packTiles({ width: 319, height: 56.25 }, 100, '16:9', 10).columns).toBe(2);
  });

  it('a tile wider than the area shrinks to the area, keeping its aspect', () => {
    // The shrunk 400×225 tile is what gets packed: one column, and three rows fit in 900.
    expect(packTiles({ width: 400, height: 900 }, 600, '16:9', 8)).toEqual({
      columns: 1,
      rows: 3,
      perPage: 3,
      tileWidth: 400,
      tileHeight: 225,
    });
  });

  it('a tile taller than the area shrinks to the area height, keeping its aspect', () => {
    // The shrunk 160×90 tile is what gets packed: one row, and nine fit across 1600.
    expect(packTiles({ width: 1600, height: 90 }, 300, '16:9', 8)).toEqual({
      columns: 9,
      rows: 1,
      perPage: 9,
      tileWidth: 160,
      tileHeight: 90,
    });
  });

  it('shrinks to whole pixels so the tile still fits in a fractional area', () => {
    const pack = packTiles({ width: 400.6, height: 900 }, 600, '16:9', 8);
    expect(pack.tileWidth).toBe(400);
    expect(pack.tileHeight).toBe(225);
  });

  it('keeps one tile in an empty area instead of dividing by zero', () => {
    const pack = packTiles({ width: 0, height: 0 }, 300, '16:9', 8);
    expect(pack.columns).toBe(1);
    expect(pack.rows).toBe(1);
    expect(pack.tileWidth).toBe(1);
  });
});

describe('fitAllTileWidth', () => {
  const area = { width: 1600, height: 900 };

  it('fits 48 16:9 tiles into 1600×900 on one page (7 columns, whole pixels)', () => {
    // Seven columns of 216.38 px beat eight of 193 px; the height allows seven rows. The width is
    // floored to a whole CSS pixel.
    const width = fitAllTileWidth(area, 48, '16:9', 8);
    expect(width).toBe(216);
    const pack = packTiles(area, width, '16:9', 8);
    expect(pack.columns).toBe(7);
    expect(pack.perPage).toBe(49);
  });

  it('1 tile fills the area', () => {
    // The 1600×900 area is exactly 16:9, so the width bounds it.
    expect(fitAllTileWidth(area, 1, '16:9', 8)).toBe(1600);
    // A taller area is bounded by its width, a wider one by its height.
    expect(fitAllTileWidth({ width: 800, height: 900 }, 1, '16:9', 8)).toBe(800);
    expect(fitAllTileWidth({ width: 1600, height: 450 }, 1, '16:9', 8)).toBe(800);
  });

  it('fits square tiles by the same rule', () => {
    // Two columns of 396 px in 800 px, and two rows of 396 px in 800 px.
    expect(fitAllTileWidth({ width: 800, height: 800 }, 4, '1:1', 8)).toBe(396);
  });

  it('treats a count below one as one tile', () => {
    expect(fitAllTileWidth(area, 0, '16:9', 8)).toBe(fitAllTileWidth(area, 1, '16:9', 8));
  });

  it('never returns a width whose packTiles perPage is below count', () => {
    const aspects: NeatTileAspect[] = ['16:9', '1:1'];
    for (const aspect of aspects) {
      for (const gap of [0, 3, 8, 16]) {
        for (const width of [320, 641, 1000, 1366, 1600, 1920, 2560]) {
          for (const height of [180, 333, 480, 720, 900, 1080, 1440]) {
            for (let count = 1; count <= 64; count++) {
              const tileWidth = fitAllTileWidth({ width, height }, count, aspect, gap);
              const { perPage } = packTiles({ width, height }, tileWidth, aspect, gap);
              // A tile of 1 px is the floor; an area too small for it cannot hold the count.
              if (tileWidth > 1) {
                expect(
                  perPage,
                  `${count} ${aspect} in ${width}×${height}, gap ${gap}`,
                ).toBeGreaterThanOrEqual(count);
              }
            }
          }
        }
      }
    }
  });

  it('returns whole pixels', () => {
    expect(Number.isInteger(fitAllTileWidth({ width: 1366, height: 641 }, 7, '16:9', 8))).toBe(
      true,
    );
  });
});
