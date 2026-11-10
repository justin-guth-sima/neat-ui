import type { DrawnLevel } from './drawing';
import type { Rect } from './layout';

/** The zoom limits, which the user's zoom keeps to as well. */
export const ZOOM_LIMITS: readonly [number, number] = [0.2, 3];
/** Room between a fitted level and the box's border, in px on screen. */
export const FIT_MARGIN = 24;

/** A zoom transform: a diagram point p is drawn at k·p + (x, y) on the box. */
export interface FitTransform {
  k: number;
  x: number;
  y: number;
}

/**
 * The transform that shows `bounds` (diagram units) as large as fits in `box` (px) less `margin`
 * on every side, the zoom held within `limits`, centered. Null for a box without a size (a hidden
 * tab): the caller fits once the box has one. An empty level (zero size) gets the largest zoom; a
 * box smaller than its margins, the smallest.
 */
export function fitTransform(
  bounds: Rect,
  box: { w: number; h: number },
  margin = FIT_MARGIN,
  limits: readonly [number, number] = ZOOM_LIMITS,
): FitTransform | null {
  if (box.w <= 0 || box.h <= 0) return null;
  const scale = (room: number, length: number) =>
    length > 0 ? Math.max(room, 0) / length : Infinity;
  const fits = Math.min(scale(box.w - 2 * margin, bounds.w), scale(box.h - 2 * margin, bounds.h));
  const k = Math.min(Math.max(fits, limits[0]), limits[1]);
  return {
    k,
    x: box.w / 2 - k * (bounds.x + bounds.w / 2),
    y: box.h / 2 - k * (bounds.y + bounds.h / 2),
  };
}

/**
 * What a fit frames: the smallest rect holding the level's nodes, its edges' routes (a stub can
 * reach past the nodes) and its placed notes' boxes. Null for a level with nothing drawn.
 */
export function levelExtent(level: DrawnLevel, notes: Iterable<Rect>): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const take = (x: number, y: number, w = 0, h = 0) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  };
  for (const { rect } of [...level.behind, ...level.front]) take(rect.x, rect.y, rect.w, rect.h);
  for (const { points } of level.layouts.values()) for (const p of points) take(p.x, p.y);
  for (const box of notes) take(box.x, box.y, box.w, box.h);
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
