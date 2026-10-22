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

/**
 * The narrowest tile the kit lays out, in CSS pixels. Below this a tile is a postage stamp, so with
 * very many items in a small area the page pages instead of shrinking tiles further. Only an area
 * smaller than this makes a tile narrower (it then shrinks to the area).
 */
export const NEAT_MIN_TILE_WIDTH = 64;

/** Height as a fraction of width. */
const HEIGHT_PER_WIDTH: Record<NeatTileAspect, number> = { '16:9': 9 / 16, '1:1': 1 };

/**
 * Garbage in must not become garbage out: NaN or Infinity from a broken measurement or input would
 * otherwise reach the layout, where a NaN never equals itself and so would emit on every change.
 * A dimension that is not a positive finite number is 0, a gap that is not a finite number of at
 * least 0 is 0.
 */
function sanitizeArea(area: NeatTileArea): NeatTileArea {
  const dimension = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
  return { width: dimension(area.width), height: dimension(area.height) };
}

function sanitizeGap(gap: number): number {
  return Number.isFinite(gap) && gap > 0 ? gap : 0;
}

/**
 * How many tiles of `tileWidth` fit into `area` with `gap` between them (and none around the
 * outside), in columns and rows. The gap counts only between tiles, which is why the area is
 * widened by one gap before dividing: `n` tiles take `n * tile + (n - 1) * gap`.
 *
 * `tileWidth` is raised to `NEAT_MIN_TILE_WIDTH` (a NaN, zero or negative one too). If even one
 * tile does not fit, it shrinks to the area while keeping its aspect, to whole CSS pixels so it
 * never rounds past the edge; that rule wins over the minimum. A tile is at least 1 px, so an
 * empty area (before the first measurement) still yields one tile.
 */
export function packTiles(
  area: NeatTileArea,
  tileWidth: number,
  aspect: NeatTileAspect,
  gap: number,
): NeatTilePack {
  const ratio = HEIGHT_PER_WIDTH[aspect];
  const { width: areaWidth, height: areaHeight } = sanitizeArea(area);
  const spacing = sanitizeGap(gap);

  const requested = Number.isNaN(tileWidth)
    ? NEAT_MIN_TILE_WIDTH
    : Math.max(NEAT_MIN_TILE_WIDTH, tileWidth);
  const fitting = Math.min(requested, areaWidth, areaHeight / ratio);
  const width = Math.max(1, fitting < requested ? Math.floor(fitting) : requested);
  const height = width * ratio;

  const columns = Math.max(1, Math.floor((areaWidth + spacing) / (width + spacing)));
  const rows = Math.max(1, Math.floor((areaHeight + spacing) / (height + spacing)));
  return { columns, rows, perPage: columns * rows, tileWidth: width, tileHeight: height };
}

/**
 * The widest tile, in whole CSS pixels, at which `count` tiles fit into `area` on one page. For
 * each column count from 1 to `count` the rows follow (`ceil(count / columns)`), and the tile is
 * bounded by both the width and the height of the area; the column count with the widest tile
 * wins. Whole pixels, rounded down, so a floating-point edge can never make `packTiles` drop a
 * row that this function counted on.
 *
 * Never below `NEAT_MIN_TILE_WIDTH`: when `count` tiles would need narrower ones, the result is
 * the minimum and the caller pages. A count that is not a finite number of at least 1 is one tile;
 * a fractional count is rounded down.
 */
export function fitAllTileWidth(
  area: NeatTileArea,
  count: number,
  aspect: NeatTileAspect,
  gap: number,
): number {
  const ratio = HEIGHT_PER_WIDTH[aspect];
  const { width: areaWidth, height: areaHeight } = sanitizeArea(area);
  const spacing = sanitizeGap(gap);
  const tiles = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;

  // More columns than this would make the tile narrower than the minimum anyway, which bounds the
  // search however large the count is.
  const widestRow = Math.floor((areaWidth + spacing) / (NEAT_MIN_TILE_WIDTH + spacing));
  const maxColumns = Math.min(tiles, Math.max(1, widestRow));

  let widest = NEAT_MIN_TILE_WIDTH;
  for (let columns = 1; columns <= maxColumns; columns++) {
    const rows = Math.ceil(tiles / columns);
    const byWidth = (areaWidth - (columns - 1) * spacing) / columns;
    const byHeight = (areaHeight - (rows - 1) * spacing) / rows / ratio;
    widest = Math.max(widest, Math.floor(Math.min(byWidth, byHeight)));
  }
  return widest;
}
