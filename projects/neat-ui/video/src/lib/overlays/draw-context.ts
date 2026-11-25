import { OVERLAY_LABEL_PLATE_COLOR } from '../theme/overlay-palette';
import type { ColorAllocator } from './colors';
import type { NeatOverlayIdentity, NeatOverlayType } from './item-colors';
import { resolveItemColor } from './item-colors';
import type { Letterbox } from './letterbox';
import type { NeatOverlayClassStyle, NeatOverlaySettings } from './overlay-settings';
import type { RleMaskCanvas } from './rle';
import type { RoiFrame } from './roi';

/** A track's recent center positions in video pixels, oldest first. */
export interface TrackTrail {
  points: { x: number; y: number }[];
  lastSeen: number;
}

/** Canvas font strings in the kit font. */
export interface OverlayFonts {
  /** Box labels, label plates and joint names. */
  readonly label: string;
  /** Classification results. */
  readonly large: string;
}

/** Everything a strategy draws one message with. Coordinates on `ctx` are CSS pixels. */
export interface DrawContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly channel: number;
  readonly settings: NeatOverlaySettings;
  /** Video pixels to overlay CSS pixels. */
  readonly box: Letterbox;
  /** The overlay's width in CSS pixels, which label plates stay inside. */
  readonly width: number;
  /** The overlay's height in CSS pixels. */
  readonly height: number;
  /** The picture is mirrored: `box.scaleX` is negative and text is right-aligned at its anchor. */
  readonly mirrored: boolean;
  /** The picture is flipped vertically: `box.scaleY` is negative; text stays upright. */
  readonly flipped: boolean;
  readonly roi: RoiFrame;
  readonly colors: ColorAllocator;
  readonly fonts: OverlayFonts;
  readonly now: number;
  /** The message repeats an earlier frame's, held over a frame that had none of its type. */
  readonly held: boolean;
  /** Track id to trail, kept across frames. */
  readonly trackHistory: Map<string, TrackTrail>;
  readonly masks: RleMaskCanvas;
  /**
   * Logs `message` the first time `key` comes up on this channel. A strategy's warnings are
   * remembered apart from drawFrame's own, so its producer-chosen keys cannot silence those.
   */
  readonly warnOnce: (key: string, message: string) => void;
}

/**
 * Draws one metadata message. `data` is the message's payload as received: a strategy reads the
 * fields it knows, skips what is missing, and may throw on a malformed payload, which drawFrame
 * catches and reports.
 */
export type DrawStrategy = (dc: DrawContext, data: unknown) => void;

/** The color to draw `item` of `type` in this frame; `overrides` are the type's rows' colors. */
export function itemColor(
  dc: DrawContext,
  type: NeatOverlayType,
  item: NeatOverlayIdentity,
  overrides?: Readonly<Record<string, string>>,
): string {
  return resolveItemColor(dc.colors, dc.channel, type, item, overrides, dc.now);
}

/** A type's class rows by label, and their colors as overrides for `itemColor`; a label's row. */
export { ɵclassStyles as classStyles, ɵstyleFor as styleFor } from '@sima/neat-ui';

export function applyLineStyle(
  ctx: CanvasRenderingContext2D,
  style: NeatOverlayClassStyle | undefined,
  lineWidth: number,
): void {
  ctx.lineWidth = style?.width ?? lineWidth;
  ctx.setLineDash(style?.style === 'dashed' ? [6, 4] : style?.style === 'dotted' ? [2, 2] : []);
}

/**
 * A label plate's height and its text's baseline above the plate's bottom, in CSS pixels, for each
 * of the overlay fonts.
 */
const LABEL_PLATES: Readonly<Record<keyof OverlayFonts, { height: number; baseline: number }>> = {
  label: { height: 18, baseline: 3 },
  large: { height: 21, baseline: 5 },
};

/** The height of a label plate in `font`, in CSS pixels, for overlays that stack plates. */
export function labelPlateHeight(font: keyof OverlayFonts): number {
  return LABEL_PLATES[font].height;
}

/** How far a label plate keeps from the overlay's edges, in CSS pixels. */
const PLATE_EDGE = 2;

/**
 * A label in `color` on a dark plate whose bottom-left is at (x, y), kept inside the overlay's top,
 * left and right edges, so a box at an edge of the picture keeps its whole label. In a mirrored
 * view the plate's bottom-right is at (x, y) and the text still reads left to right. The plate is
 * the one backing of the overlays' text, so a label in any class color reads over any picture.
 */
export function drawLabelPlate(
  dc: DrawContext,
  text: string,
  x: number,
  y: number,
  color: string,
  font: keyof OverlayFonts = 'label',
): void {
  const { ctx } = dc;
  const paddingX = 4;
  const { height, baseline } = LABEL_PLATES[font];
  ctx.font = dc.fonts[font];
  const width = ctx.measureText(text).width + paddingX * 2;
  // The left edge wins over the right for a plate wider than the overlay.
  const plateX = Math.max(
    PLATE_EDGE,
    Math.min(dc.mirrored ? x - width : x, dc.width - PLATE_EDGE - width),
  );
  const plateY = Math.max(PLATE_EDGE, y - height);
  ctx.fillStyle = OVERLAY_LABEL_PLATE_COLOR;
  ctx.fillRect(plateX, plateY, width, height);
  ctx.fillStyle = color;
  // Text is right-aligned in a mirrored view (see drawFrame), so it is anchored at the plate's end.
  ctx.fillText(
    text,
    dc.mirrored ? plateX + width - paddingX : plateX + paddingX,
    plateY + height - baseline,
  );
}

/** How far a box's label plate stands above the box, in CSS pixels. */
const BOX_LABEL_GAP = 6;

/**
 * Where a box's label stands, in CSS pixels, for the box `[x, y, width, height]` in video pixels:
 * `left` is the box's left edge in the picture, mapped (its right edge on screen when mirrored, where
 * the plate ends), and `top` is the box's top edge on screen, the smaller of its two mapped y edges,
 * so a flipped box is labeled above it, not below. Every overlay that labels a box anchors it here.
 */
export function boxLabelAnchor(
  box: Letterbox,
  x: number,
  y: number,
  width: number,
  height: number,
): { left: number; top: number } {
  const top = y * box.scaleY + box.offsetY;
  return {
    left: x * box.scaleX + box.offsetX,
    top: Math.min(top, top + height * box.scaleY),
  };
}

/** A box's label: its text and color, and its anchor in CSS pixels from `boxLabelAnchor`. */
export interface BoxLabel {
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly color: string;
}

/**
 * The labels of a message's boxes, each on a label plate just above its anchor, the box's top-left
 * corner on screen (its top-right in a mirrored view), or inside the box when the box is at the
 * overlay's top edge. An
 * overlay draws them after all of its boxes, outlines and masks, so none of those crosses a label;
 * where boxes overlap, a later label covers an earlier one. Every overlay that labels a box places
 * the label here.
 */
export function drawBoxLabels(dc: DrawContext, labels: readonly BoxLabel[]): void {
  for (const { text, left, top, color } of labels) {
    drawLabelPlate(dc, text, left, top - BOX_LABEL_GAP, color);
  }
}

/**
 * `text` with its confidence after it as a whole percentage, "car (87%)", or `text` alone when the
 * confidence is missing or not a finite number, so a message without one never reads "(NaN%)".
 * Every overlay that shows a confidence words it here.
 */
export function withConfidence(text: string, confidence: unknown): string {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return text;
  return `${text} (${Math.round(confidence * 100)}%)`;
}
