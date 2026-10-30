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
 * on every side, the zoom held within `limits`, centred. Null for a box without a size (a hidden
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
