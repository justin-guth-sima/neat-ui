import type { BoxLabel, DrawContext, DrawStrategy } from '../draw-context';
import {
  applyLineStyle,
  boxLabelAnchor,
  classStyles,
  drawBoxLabels,
  itemColor,
  styleFor,
  withConfidence,
} from '../draw-context';
import { MAX_RLE_MASK_PIXELS } from '../rle';
import { drawRoiOnce, passesRoiFilter } from '../roi';

type Point = readonly [number, number];

interface Segment {
  id?: unknown;
  label?: unknown;
  confidence?: unknown;
  /** `[x, y, width, height]` in video pixels; derived from a polygon mask when missing. */
  bbox?: unknown;
  mask_format?: unknown;
  /** Polygon points in video pixels, or an RLE mask. */
  mask?: unknown;
  show_rectangle?: unknown;
}

/** The fields of a `segmentation` payload this overlay reads. */
interface SegmentationData {
  segments?: unknown;
}

/** An RLE mask: `size` is `[height, width]`, `counts` the run lengths (see decodeRleMaskAlpha). */
interface RleMask {
  size?: unknown;
  counts?: unknown;
}

function polygonBounds(points: readonly Point[]): number[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return [minX, minY, maxX - minX, maxY - minY];
}

/**
 * Warns about a segment that cannot be drawn. The same segment comes back every frame, so each
 * channel and id warns once.
 */
function warnDropped(dc: DrawContext, id: unknown, reason: string): void {
  const name = String(id ?? '<no id>');
  dc.warnOnce(
    `segment:${name}`,
    `segmentation: channel ${dc.channel} dropped RLE segment "${name}": ${reason}`,
  );
}

/**
 * Decodes an RLE mask, tints it and stretches it over `bbox`. Returns false, after warning, for a
 * mask that cannot be drawn.
 */
function drawRleMask(
  dc: DrawContext,
  segment: Segment,
  bbox: readonly number[],
  color: string,
  opacity: number,
): boolean {
  const mask = segment.mask as RleMask | null | undefined;
  if (!mask || !Array.isArray(mask.size)) {
    warnDropped(dc, segment.id, 'mask.size must be an array [mask_h, mask_w]');
    return false;
  }
  if (!Array.isArray(mask.counts)) {
    warnDropped(
      dc,
      segment.id,
      'mask.counts must be an array of run lengths, not a compressed byte string',
    );
    return false;
  }
  const maskHeight = Math.floor(mask.size[0]);
  const maskWidth = Math.floor(mask.size[1]);
  if (!(maskWidth > 0) || !(maskHeight > 0)) {
    warnDropped(dc, segment.id, `mask.size must be positive, got ${maskHeight}x${maskWidth}`);
    return false;
  }
  if (maskWidth * maskHeight > MAX_RLE_MASK_PIXELS) {
    warnDropped(
      dc,
      segment.id,
      `mask is ${maskHeight}x${maskWidth}, over the ${MAX_RLE_MASK_PIXELS} pixel decode buffer limit`,
    );
    return false;
  }

  const image = dc.masks.paint(mask.counts, maskWidth, maskHeight, color);
  const { ctx, box } = dc;
  ctx.save();
  ctx.globalAlpha = opacity;
  // Masks arrive at mask-head resolution and are stretched over a much larger bbox, so the
  // upscale is interpolated rather than shown as mask-sized blocks.
  ctx.imageSmoothingEnabled = true;
  // A negative destination size does not flip an image (the browser normalizes the rectangle), so
  // a mirrored or flipped mapping turns the context about the mapped corner instead.
  ctx.translate(bbox[0] * box.scaleX + box.offsetX, bbox[1] * box.scaleY + box.offsetY);
  ctx.scale(Math.sign(box.scaleX), Math.sign(box.scaleY));
  ctx.drawImage(image, 0, 0, bbox[2] * Math.abs(box.scaleX), bbox[3] * Math.abs(box.scaleY));
  ctx.restore();
  return true;
}

/**
 * Polygon or RLE masks at the mask opacity, with an outline or box and a label in the class color on
 * a label plate.
 */
export const drawSegmentation: DrawStrategy = (dc, data) => {
  const segments = (data as SegmentationData | null | undefined)?.segments;
  if (!Array.isArray(segments)) return;

  const { ctx, box, settings } = dc;
  const type = settings.types.segmentation;
  if (settings.general.showRoi) drawRoiOnce(ctx, dc.roi);
  if (!type.visible) return;

  const { styles, overrides } = classStyles(type.objects);
  const labels: BoxLabel[] = [];
  for (const segment of segments as Segment[]) {
    // A segment without a confidence counts as fully confident; its caption shows none.
    if (Number(segment.confidence ?? 1) < type.confidenceThreshold) continue;
    if (segment.mask_format !== 'polygon' && segment.mask_format !== 'rle') continue;

    let bbox =
      Array.isArray(segment.bbox) && segment.bbox.length === 4 ? (segment.bbox as number[]) : null;
    let polygon: readonly Point[] | null = null;
    if (segment.mask_format === 'polygon') {
      if (!Array.isArray(segment.mask) || segment.mask.length < 3) continue;
      polygon = segment.mask as Point[];
      bbox ??= polygonBounds(polygon);
    }
    // Polygon bboxes are derived above, so only RLE can still be missing one.
    if (!bbox) {
      warnDropped(dc, segment.id, 'an RLE mask needs a bbox as its destination rectangle');
      continue;
    }
    if (!passesRoiFilter(dc.roi, bbox, box, settings.general.applyRoiFiltering)) continue;

    const color = itemColor(dc, 'segmentation', segment, overrides);
    ctx.strokeStyle = color;
    applyLineStyle(ctx, styleFor(styles, segment.label), settings.general.lineWidth);
    ctx.fillStyle = color;

    if (polygon) {
      ctx.beginPath();
      ctx.moveTo(
        polygon[0][0] * box.scaleX + box.offsetX,
        polygon[0][1] * box.scaleY + box.offsetY,
      );
      for (let i = 1; i < polygon.length; i += 1) {
        ctx.lineTo(
          polygon[i][0] * box.scaleX + box.offsetX,
          polygon[i][1] * box.scaleY + box.offsetY,
        );
      }
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha = type.maskOpacity;
      ctx.fill();
      ctx.restore();
      ctx.stroke();
    } else if (!drawRleMask(dc, segment, bbox, color, type.maskOpacity)) {
      continue;
    }

    const [x, y, w, h] = bbox;
    if (segment.show_rectangle === true) {
      ctx.strokeRect(
        x * box.scaleX + box.offsetX,
        y * box.scaleY + box.offsetY,
        w * box.scaleX,
        h * box.scaleY,
      );
    }
    labels.push({
      text: withConfidence(String(segment.label), segment.confidence),
      ...boxLabelAnchor(box, x, y, w, h),
      color,
    });
  }
  drawBoxLabels(dc, labels);
};
