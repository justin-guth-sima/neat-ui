import type { DrawStrategy } from '../draw-context';
import { drawLabelPlate, itemColor, labelPlateHeight, withConfidence } from '../draw-context';

/** The fields of a `classification` payload this overlay reads. */
interface ClassificationData {
  top_classes?: readonly { label?: unknown; confidence?: unknown }[];
}

/** From the picture's top-left corner to the first plate, and between plates, in CSS pixels. */
const INSET = 8;
const GAP = 2;

/**
 * The top three classes as a list in the picture's top-left corner (top-right when mirrored), each
 * in its class color on a label plate. The list is laid out in CSS pixels, as its text is, so its
 * rows never overlap however small the picture is shown.
 */
export const drawClassification: DrawStrategy = (dc, data) => {
  const classes = (data as ClassificationData | null | undefined)?.top_classes;
  if (!classes || !dc.settings.types.classification.visible) return;

  const { box } = dc;
  const height = labelPlateHeight('large');
  const x = box.offsetX + (dc.mirrored ? -INSET : INSET);
  classes.slice(0, 3).forEach((entry, i) => {
    // Class colors only: classification has no style rows and no threshold.
    const color = itemColor(dc, 'classification', entry);
    const bottom = box.offsetY + INSET + height + i * (height + GAP);
    drawLabelPlate(
      dc,
      withConfidence(String(entry.label), entry.confidence),
      x,
      bottom,
      color,
      'large',
    );
  });
};
