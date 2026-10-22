/** The shape of a tile: 16:9 for video, 1:1 for square thumbnails. */
export type NeatTileAspect = '16:9' | '1:1';

export interface NeatTileArea {
  readonly width: number;
  readonly height: number;
}

export interface NeatTilePack {
  readonly columns: number;
  readonly rows: number;
  /** How many tiles fit at once: `columns * rows`. */
  readonly perPage: number;
  /** The tile size actually used; below the requested width only when one tile did not fit. */
  readonly tileWidth: number;
  readonly tileHeight: number;
}

/** Height as a fraction of width. */
const HEIGHT_PER_WIDTH: Record<NeatTileAspect, number> = { '16:9': 9 / 16, '1:1': 1 };

/**
 * How many tiles of `tileWidth` fit into `area` with `gap` between them (and none around the
 * outside), in columns and rows. The gap counts only between tiles, which is why the area is
 * widened by one gap before dividing: `n` tiles take `n * tile + (n - 1) * gap`.
 *
 * If even one tile does not fit, it shrinks to the area while keeping its aspect, to whole CSS
 * pixels so it never rounds past the edge. A tile is at least 1 px, so an empty area (before the
 * first measurement) still yields one tile.
 */
export function packTiles(
  area: NeatTileArea,
  tileWidth: number,
  aspect: NeatTileAspect,
  gap: number,
): NeatTilePack {
  const ratio = HEIGHT_PER_WIDTH[aspect];
  const fitting = Math.min(tileWidth, area.width, area.height / ratio);
  const width = Math.max(1, fitting < tileWidth ? Math.floor(fitting) : tileWidth);
  const height = width * ratio;

  const columns = Math.max(1, Math.floor((area.width + gap) / (width + gap)));
  const rows = Math.max(1, Math.floor((area.height + gap) / (height + gap)));
  return { columns, rows, perPage: columns * rows, tileWidth: width, tileHeight: height };
}

/**
 * The widest tile, in whole CSS pixels, at which `count` tiles fit into `area` on one page. For
 * each column count from 1 to `count` the rows follow (`ceil(count / columns)`), and the tile is
 * bounded by both the width and the height of the area; the column count with the widest tile
 * wins. Whole pixels, rounded down, so a floating-point edge can never make `packTiles` drop a
 * row that this function counted on.
 *
 * Returns 1 when the area is too small for `count` tiles even at that size.
 */
export function fitAllTileWidth(
  area: NeatTileArea,
  count: number,
  aspect: NeatTileAspect,
  gap: number,
): number {
  const ratio = HEIGHT_PER_WIDTH[aspect];
  const tiles = Math.max(1, count);

  let widest = 1;
  for (let columns = 1; columns <= tiles; columns++) {
    const rows = Math.ceil(tiles / columns);
    const byWidth = (area.width - (columns - 1) * gap) / columns;
    const byHeight = (area.height - (rows - 1) * gap) / rows / ratio;
    widest = Math.max(widest, Math.floor(Math.min(byWidth, byHeight)));
  }
  return widest;
}
