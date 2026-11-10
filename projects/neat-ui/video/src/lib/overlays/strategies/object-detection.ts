import type { DrawStrategy } from '../draw-context';
import { applyLineStyle, classStyles, identityColor, percent, styleFor } from '../draw-context';
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

/** Boxes with a `label (confidence%)` caption, in the class color. */
export const drawObjectDetection: DrawStrategy = (dc, data) => {
  const objects = (data as DetectionData | null | undefined)?.objects;
  if (!objects) return;

  const { ctx, box, settings } = dc;
  const type = settings.types['object-detection'];
  // The ROI belongs to the channel, not to the type, so a hidden type still draws it.
  if (settings.general.showRoi) drawRoiOnce(ctx, dc.roi);
  if (!type.visible) return;

  const { styles, overrides } = classStyles(type.objects);
  for (const object of objects) {
    // Number() keeps the comparison's coercion: an object without a confidence passes.
    if (Number(object.confidence) < type.confidenceThreshold) continue;
    const [x, y, w, h] = object.bbox;
    if (!passesRoiFilter(dc.roi, object.bbox, box, settings.general.applyRoiFiltering)) continue;

    const color = identityColor(dc, 'class', object.label, overrides);
    ctx.strokeStyle = color;
    applyLineStyle(ctx, styleFor(styles, object.label), settings.general.lineWidth);
    ctx.font = dc.fonts.label;
    ctx.fillStyle = color;
    ctx.strokeRect(
      x * box.scaleX + box.offsetX,
      y * box.scaleY + box.offsetY,
      w * box.scaleX,
      h * box.scaleY,
    );
    ctx.fillText(
      `${object.label} (${percent(object.confidence)}%)`,
      (x + 2) * box.scaleX + box.offsetX,
      (y - 6) * box.scaleY + box.offsetY,
    );
  }
};
