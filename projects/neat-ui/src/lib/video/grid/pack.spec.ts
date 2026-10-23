import { fitAllTileWidth, NEAT_MIN_TILE_WIDTH, NeatTileArea, packTiles } from './pack';

describe('packTiles', () => {
  it('packs 16:9 tiles: 1920×1000 area, width 300, gap 8 → 6 columns × 5 rows', () => {
    // Tile height is 168.75, so a row takes 176.75 with the gap: floor(1008 / 176.75) = 5.
    expect(packTiles({ width: 1920, height: 1000 }, 300, 8)).toEqual({
      columns: 6,
      rows: 5,
      perPage: 30,
      tileWidth: 300,
      tileHeight: 168.75,
    });
  });

  it('counts the gap only between tiles, not after the last one', () => {
    // Exactly three 100 px tiles and two 10 px gaps.
    expect(packTiles({ width: 320, height: 56.25 }, 100, 10).columns).toBe(3);
    expect(packTiles({ width: 319, height: 56.25 }, 100, 10).columns).toBe(2);
  });

  it('a tile wider than the area shrinks to the area, keeping its aspect', () => {
    // The shrunk 400×225 tile is what gets packed: one column, and three rows fit in 900.
    expect(packTiles({ width: 400, height: 900 }, 600, 8)).toEqual({
      columns: 1,
      rows: 3,
      perPage: 3,
      tileWidth: 400,
      tileHeight: 225,
    });
  });

  it('a tile taller than the area shrinks to the area height, keeping its aspect', () => {
    // The shrunk 160×90 tile is what gets packed: one row, and nine fit across 1600.
    expect(packTiles({ width: 1600, height: 90 }, 300, 8)).toEqual({
      columns: 9,
      rows: 1,
      perPage: 9,
      tileWidth: 160,
      tileHeight: 90,
    });
  });

  it('shrinks to whole pixels so the tile still fits in a fractional area', () => {
    const pack = packTiles({ width: 400.6, height: 900 }, 600, 8);
    expect(pack.tileWidth).toBe(400);
    expect(pack.tileHeight).toBe(225);
  });

  it('raises a tile narrower than the minimum to the minimum', () => {
    expect(NEAT_MIN_TILE_WIDTH).toBe(64);
    for (const requested of [63, 10, 1, 0, -5, Number.NaN, -Infinity]) {
      const pack = packTiles({ width: 1920, height: 1000 }, requested, 8);
      expect(pack.tileWidth, `requested ${requested}`).toBe(64);
      expect(pack.tileHeight).toBe(36);
    }
    expect(packTiles({ width: 1920, height: 1000 }, 64, 8).tileWidth).toBe(64);
  });

  it('lets the shrink rule win over the minimum when the area is smaller', () => {
    expect(packTiles({ width: 50, height: 500 }, 10, 8)).toMatchObject({
      tileWidth: 50,
      tileHeight: 28.125,
    });
    expect(packTiles({ width: 500, height: 18 }, 10, 8)).toMatchObject({ tileWidth: 32 });
  });

  it('treats a non-finite or non-positive area as empty, never as NaN', () => {
    const bad = [Number.NaN, Infinity, -Infinity, -10, 0];
    for (const width of bad) {
      for (const height of bad) {
        const pack = packTiles({ width, height }, 300, 8);
        expect(pack, `${width}×${height}`).toEqual({
          columns: 1,
          rows: 1,
          perPage: 1,
          tileWidth: 1,
          tileHeight: 9 / 16,
        });
      }
    }
  });

  it('packs one bad dimension as empty and keeps the other', () => {
    const pack = packTiles({ width: Number.NaN, height: 1000 }, 300, 8);
    expect(pack).toMatchObject({ columns: 1, tileWidth: 1 });
  });

  it('treats a non-finite or negative gap as 0', () => {
    const reference = packTiles({ width: 1800, height: 1000 }, 300, 0);
    expect(reference.columns).toBe(6);
    for (const gap of [Number.NaN, Infinity, -Infinity, -8]) {
      expect(packTiles({ width: 1800, height: 1000 }, 300, gap), `gap ${gap}`).toEqual(reference);
    }
  });

  it('shrinks an infinitely wide request to the area', () => {
    expect(packTiles({ width: 400, height: 900 }, Infinity, 8)).toMatchObject({
      tileWidth: 400,
      columns: 1,
    });
  });

  it('keeps one tile in an empty area instead of dividing by zero', () => {
    const pack = packTiles({ width: 0, height: 0 }, 300, 8);
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
    const width = fitAllTileWidth(area, 48, 8);
    expect(width).toBe(216);
    const pack = packTiles(area, width, 8);
    expect(pack.columns).toBe(7);
    expect(pack.perPage).toBe(49);
  });

  it('1 tile fills the area', () => {
    // The 1600×900 area is exactly 16:9, so the width bounds it.
    expect(fitAllTileWidth(area, 1, 8)).toBe(1600);
    // A taller area is bounded by its width, a wider one by its height.
    expect(fitAllTileWidth({ width: 800, height: 900 }, 1, 8)).toBe(800);
    expect(fitAllTileWidth({ width: 1600, height: 450 }, 1, 8)).toBe(800);
  });

  it('treats a count below one as one tile', () => {
    expect(fitAllTileWidth(area, 0, 8)).toBe(fitAllTileWidth(area, 1, 8));
  });

  it('never returns a width below the minimum, so very many channels page instead', () => {
    expect(fitAllTileWidth({ width: 400, height: 300 }, 500, 8)).toBe(64);
    expect(fitAllTileWidth({ width: 400, height: 300 }, 1e9, 8)).toBe(64);
    // Even an area smaller than the minimum returns it; packTiles then shrinks the tile to the area.
    expect(fitAllTileWidth({ width: 40, height: 30 }, 1, 8)).toBe(64);
  });

  it('treats a count that is not a finite number as one tile, and rounds a fraction down', () => {
    const one = fitAllTileWidth(area, 1, 8);
    for (const count of [Infinity, -Infinity, Number.NaN, -3, 0, 0.5]) {
      expect(fitAllTileWidth(area, count, 8), `count ${count}`).toBe(one);
    }
    expect(fitAllTileWidth(area, 48.9, 8)).toBe(fitAllTileWidth(area, 48, 8));
  });

  it('treats a non-finite or non-positive area as empty, never as NaN', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity, -10, 0]) {
      expect(fitAllTileWidth({ width: bad, height: bad }, 12, 8), `${bad}`).toBe(64);
      expect(fitAllTileWidth({ width: 1600, height: bad }, 12, 8), `${bad}`).toBe(64);
    }
  });

  it('treats a non-finite or negative gap as 0', () => {
    const reference = fitAllTileWidth(area, 12, 0);
    for (const gap of [Number.NaN, Infinity, -Infinity, -8]) {
      expect(fitAllTileWidth(area, 12, gap), `gap ${gap}`).toBe(reference);
    }
  });

  describe('over a sweep of areas, gaps and counts', () => {
    // Whole and fractional values: content boxes are fractional on zoomed or scaled screens.
    const gaps = [0, 0.5, 3, 8, 16, 2.75];
    const widths = [320, 641, 1000, 1366.5, 1600, 1919.25, 2560];
    const heights = [180, 333.3, 480, 720, 899.5, 1080, 1440.75];

    /** Every case in the sweep for which `violates` holds, described for the failure message. */
    function violations(
      violates: (case_: {
        size: NeatTileArea;
        gap: number;
        count: number;
        tileWidth: number;
      }) => boolean,
    ): string[] {
      const found: string[] = [];
      for (const gap of gaps) {
        for (const width of widths) {
          for (const height of heights) {
            const size = { width, height };
            for (let count = 1; count <= 64; count++) {
              const tileWidth = fitAllTileWidth(size, count, gap);
              if (violates({ size, gap, count, tileWidth })) {
                found.push(`${count} in ${width}×${height}, gap ${gap}: ${tileWidth}`);
              }
            }
          }
        }
      }
      return found;
    }

    it('never returns a width whose packTiles perPage is below count (above the minimum)', () => {
      expect(
        violations(
          ({ size, gap, count, tileWidth }) =>
            tileWidth > NEAT_MIN_TILE_WIDTH && packTiles(size, tileWidth, gap).perPage < count,
        ),
      ).toEqual([]);
    });

    it('returns the widest whole-pixel width: one pixel more no longer fits (above the minimum)', () => {
      expect(
        violations(({ size, gap, count, tileWidth }) => {
          const wider = packTiles(size, tileWidth + 1, gap);
          // packTiles shrinks a tile that does not fit even once; that is not "fitting".
          return (
            tileWidth > NEAT_MIN_TILE_WIDTH &&
            wider.tileWidth === tileWidth + 1 &&
            wider.perPage >= count
          );
        }),
      ).toEqual([]);
    });

    it('never returns less than the minimum or a fraction', () => {
      expect(
        violations(
          ({ tileWidth }) => tileWidth < NEAT_MIN_TILE_WIDTH || !Number.isInteger(tileWidth),
        ),
      ).toEqual([]);
    });
  });

  it('returns whole pixels', () => {
    expect(Number.isInteger(fitAllTileWidth({ width: 1366, height: 641 }, 7, 8))).toBe(true);
  });
});
