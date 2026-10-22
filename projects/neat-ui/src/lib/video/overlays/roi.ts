import { OVERLAY_ROI_COLORS } from '../../theme/overlay-palette';
import type { Letterbox } from './letterbox';
import type { NeatRoiPolygon } from './overlay-settings';

type Point = readonly [x: number, y: number];

interface MappedPolygon {
  readonly type: NeatRoiPolygon['type'];
  /** In overlay (CSS pixel) coordinates. */
  readonly points: readonly Point[];
}

/** A channel's ROI for one frame: the polygons mapped onto the overlay once, and drawn once. */
export interface RoiFrame {
  readonly polygons: readonly MappedPolygon[];
  /** Detection, segmentation and tracking each draw the ROI; the first one in a frame does. */
  drawn: boolean;
}

export function mapRoi(
  polygons: readonly NeatRoiPolygon[],
  videoWidth: number,
  videoHeight: number,
  box: Letterbox,
): RoiFrame {
  return {
    polygons: polygons.map(({ type, points }) => ({
      type,
      points: points.map((p): Point => [
        p.x * videoWidth * box.scaleX + box.offsetX,
        p.y * videoHeight * box.scaleY + box.offsetY,
      ]),
    })),
    drawn: false,
  };
}

/** Draws the polygons unless an earlier overlay of this frame already has. */
export function drawRoiOnce(ctx: CanvasRenderingContext2D, roi: RoiFrame): void {
  if (roi.drawn) return;
  roi.drawn = true;
  for (const { type, points } of roi.polygons) {
    if (points.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    const colors =
      type === 'inclusion' ? OVERLAY_ROI_COLORS.inclusion : OVERLAY_ROI_COLORS.exclusion;
    ctx.fillStyle = colors.fill;
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }
}

/** Even-odd ray cast. A polygon with fewer than three points contains nothing. */
function contains(polygon: MappedPolygon, x: number, y: number): boolean {
  const pts = polygon.points;
  if (pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Whether an overlay with video-pixel box `[x, y, w, h]` is shown: its centre lies in an inclusion
 * polygon (or there is none) and in no exclusion polygon. Always true with filtering off.
 */
export function passesRoiFilter(
  roi: RoiFrame,
  bbox: readonly number[],
  box: Letterbox,
  applyRoiFiltering: boolean,
): boolean {
  if (!applyRoiFiltering) return true;
  const [x, y, w, h] = bbox;
  const cx = (x + w / 2) * box.scaleX + box.offsetX;
  const cy = (y + h / 2) * box.scaleY + box.offsetY;
  const inclusion = roi.polygons.filter((polygon) => polygon.type === 'inclusion');
  const exclusion = roi.polygons.filter((polygon) => polygon.type === 'exclusion');
  const included = inclusion.length === 0 || inclusion.some((polygon) => contains(polygon, cx, cy));
  return included && !exclusion.some((polygon) => contains(polygon, cx, cy));
}
