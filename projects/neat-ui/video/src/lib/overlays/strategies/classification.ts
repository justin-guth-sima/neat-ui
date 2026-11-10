import type { DrawStrategy } from '../draw-context';
import { identityColor, percent } from '../draw-context';

/** The fields of a `classification` payload this overlay reads. */
interface ClassificationData {
  top_classes?: readonly { label?: unknown; confidence?: unknown }[];
}

/** The top three classes as a list in the frame's top-left corner, each in its class color. */
export const drawClassification: DrawStrategy = (dc, data) => {
  const classes = (data as ClassificationData | null | undefined)?.top_classes;
  if (!classes || !dc.settings.types.classification.visible) return;

  const { ctx, box } = dc;
  ctx.font = dc.fonts.large;
  classes.slice(0, 3).forEach((entry, i) => {
    // Class colors only: classification has no style rows and no threshold.
    ctx.fillStyle = identityColor(dc, 'class', entry.label);
    ctx.fillText(
      `${entry.label} (${percent(entry.confidence)}%)`,
      10 * box.scaleX + box.offsetX,
      (20 + i * 20) * box.scaleY + box.offsetY,
    );
  });
};
