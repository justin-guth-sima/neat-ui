import { OVERLAY_LABEL_PLATE_COLOR } from '../theme/overlay-palette';
import type { ColorAllocator, ColorNamespace } from './colors';
import { resolveColor } from './colors';
import type { Letterbox } from './letterbox';
import type { NeatOverlayClassStyle, NeatOverlaySettings } from './overlay-settings';
import type { RleMaskCanvas } from './rle';
import type { RoiFrame } from './roi';

/** A track's recent centre positions in video pixels, oldest first. */
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

export function identityColor(
  dc: DrawContext,
  namespace: ColorNamespace,
  identity: unknown,
  overrides?: Readonly<Record<string, string>>,
): string {
  return resolveColor({
    allocator: dc.colors,
    channelIndex: dc.channel,
    namespace,
    identity,
    overrides,
    now: dc.now,
  });
}

/** A type's class rows by label, and their colours as overrides for `identityColor`. */
export function classStyles(rows: readonly NeatOverlayClassStyle[]): {
  styles: Readonly<Record<string, NeatOverlayClassStyle>>;
  overrides: Readonly<Record<string, string>>;
} {
  // No prototype, so a producer's label such as "__proto__" or "constructor" finds no row.
  const styles: Record<string, NeatOverlayClassStyle> = Object.create(null);
  const overrides: Record<string, string> = Object.create(null);
  for (const row of rows) {
    styles[row.label] = row;
    overrides[row.label] = row.color;
  }
  return { styles, overrides };
}

/** The row for `label`, or the `default` row. */
export function styleFor(
  styles: Readonly<Record<string, NeatOverlayClassStyle>>,
  label: unknown,
): NeatOverlayClassStyle | undefined {
  return styles[String(label)] ?? styles['default'];
}

export function applyLineStyle(
  ctx: CanvasRenderingContext2D,
  style: NeatOverlayClassStyle | undefined,
  lineWidth: number,
): void {
  ctx.lineWidth = style?.width ?? lineWidth;
  ctx.setLineDash(style?.style === 'dashed' ? [6, 4] : style?.style === 'dotted' ? [2, 2] : []);
}

/** A label in `color` on a dark plate whose bottom-left is at (x, y), kept inside the top edge. */
export function drawLabelPlate(
  dc: DrawContext,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  const { ctx } = dc;
  const paddingX = 4;
  const paddingY = 3;
  const height = 18;
  ctx.font = dc.fonts.label;
  const width = ctx.measureText(text).width + paddingX * 2;
  const labelY = Math.max(height + 2, y);
  ctx.fillStyle = OVERLAY_LABEL_PLATE_COLOR;
  ctx.fillRect(x, labelY - height, width, height);
  ctx.fillStyle = color;
  ctx.fillText(text, x + paddingX, labelY - paddingY);
}

/** A confidence in 0..1 as a whole percentage. */
export function percent(confidence: unknown): number {
  return Math.round(Number(confidence) * 100);
}
