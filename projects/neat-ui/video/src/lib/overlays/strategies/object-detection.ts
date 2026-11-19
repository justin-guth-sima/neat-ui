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
  }>;
}

/**
 * Boxes, each with its `label (confidence%)` in the class color on a label plate, the label alone
 * for an object without a confidence.
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
    const left = x * box.scaleX + box.offsetX;
    const top = y * box.scaleY + box.offsetY;
    ctx.strokeStyle = color;
    applyLineStyle(ctx, styleFor(styles, object.label), settings.general.lineWidth);
    ctx.strokeRect(left, top, w * box.scaleX, h * box.scaleY);
    labels.push({
      text: withConfidence(String(object.label), object.confidence),
      left,
      top,
      color,
    });
  }
  drawBoxLabels(dc, labels);
};
