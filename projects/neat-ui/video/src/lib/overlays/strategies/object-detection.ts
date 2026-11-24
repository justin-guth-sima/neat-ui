import type { BoxLabel, DrawStrategy } from '../draw-context';
import {
  applyLineStyle,
  classStyles,
  drawBoxLabels,
  itemColor,
  styleFor,
  withConfidence,
} from '../draw-context';
import { drawRoiOnce, passesRoiFilter } from '../roi';

/** The fields of an `object-detection` payload this overlay reads. */
interface DetectionData {
  objects?: Iterable<{
    label?: unknown;
    confidence?: unknown;
    /** `[x, y, width, height]` in video pixels. */
    bbox: readonly number[];
    /**
     * `[centerX, centerY, width, height, angle]` in video pixels and radians, the angle turning
     * the box clockwise on screen. Anything but five finite numbers is ignored.
     */
    oriented_bbox?: unknown;
  }>;
}

/** Two heights this close (video pixels) are the same height. */
const SAME_HEIGHT = 1e-6;

/**
 * The four corners, in video pixels, of a valid `[cx, cy, width, height, angle]`: top-left,
 * top-right, bottom-right and bottom-left of the box before it turned, turned clockwise on screen
 * by `angle` radians about the center. Null for anything but five finite numbers.
 */
function orientedCorners(value: unknown): readonly [number, number][] | null {
  if (!Array.isArray(value) || value.length !== 5) return null;
  if (!value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return null;
  const [cx, cy, w, h, angle] = value as number[];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([dx, dy]): [number, number] => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
}

/**
 * The corner a rotated box's label stands at: the topmost one, of two equally high the one with
 * the smaller x in video pixels, so a box at angle 0 labels at its top-left as an upright box does.
 */
function labelCorner(corners: readonly [number, number][]): [number, number] {
  return corners.reduce((best, corner) => {
    if (corner[1] < best[1] - SAME_HEIGHT) return corner;
    if (Math.abs(corner[1] - best[1]) <= SAME_HEIGHT && corner[0] < best[0]) return corner;
    return best;
  });
}

/**
 * Boxes, each with its `label (confidence%)` in the class color on a label plate, the label alone
 * for an object without a confidence.
 *
 * An object with an `oriented_bbox` is drawn as that rotated box, one closed path through its four
 * corners, and its label stands upright at the topmost corner. Without a valid one it is drawn
 * from `bbox`, which stays its upright extent: the region filter reads it either way.
 */
export const drawObjectDetection: DrawStrategy = (dc, data) => {
  const objects = (data as DetectionData | null | undefined)?.objects;
  if (!objects) return;

  const { ctx, box, settings } = dc;
  const type = settings.types['object-detection'];
  // The ROI belongs to the channel, not to the type, so a hidden type still draws it.
  if (settings.general.showRoi) drawRoiOnce(ctx, dc.roi);
  if (!type.visible) return;

  const { styles, overrides } = classStyles(type.objects);
  const labels: BoxLabel[] = [];
  for (const object of objects) {
    // Number() keeps the comparison's coercion: an object without a confidence passes.
    if (Number(object.confidence) < type.confidenceThreshold) continue;
    const [x, y, w, h] = object.bbox;
    if (!passesRoiFilter(dc.roi, object.bbox, box, settings.general.applyRoiFiltering)) continue;

    const color = itemColor(dc, 'object-detection', object, overrides);
    ctx.strokeStyle = color;
    applyLineStyle(ctx, styleFor(styles, object.label), settings.general.lineWidth);
    const corners = orientedCorners(object.oriented_bbox);
    let left: number;
    let top: number;
    if (corners) {
      ctx.beginPath();
      corners.forEach(([cx, cy], i) => {
        const px = cx * box.scaleX + box.offsetX;
        const py = cy * box.scaleY + box.offsetY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.stroke();
      const [ax, ay] = labelCorner(corners);
      left = ax * box.scaleX + box.offsetX;
      top = ay * box.scaleY + box.offsetY;
    } else {
      left = x * box.scaleX + box.offsetX;
      top = y * box.scaleY + box.offsetY;
      ctx.strokeRect(left, top, w * box.scaleX, h * box.scaleY);
    }
    labels.push({
      text: withConfidence(String(object.label), object.confidence),
      left,
      top,
      color,
    });
  }
  drawBoxLabels(dc, labels);
};
