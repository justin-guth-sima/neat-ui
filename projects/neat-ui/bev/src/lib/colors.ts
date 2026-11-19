import {
  neatResolveColor,
  type NeatRgb,
  ɵclassStyles as classStyles,
  ɵcreateColorAllocator as createColorAllocator,
  type ɵColorAllocator as ColorAllocator,
  ɵheldColor as heldColor,
  type ɵNeatOverlayColors as NeatOverlayColors,
  ɵresolveColor as resolveColor,
  ɵstyleFor as styleFor,
} from '@sima/neat-ui';
import type { NeatOverlayClassStyle, NeatOverlayLineStyle } from '@sima/neat-ui/video';

/*
 * The color and line of each label, as the video overlays draw it: a style row for the label (or
 * the `default` row) first, then the page's class colors, which every tile shares, so "car" has
 * one color in the tiles and in the bird's-eye view. The opacities of the fills are stated here,
 * once.
 */

/** How opaque an object's fill is under its outline. */
export const OBJECT_FILL_ALPHA = 0.25;
/** How opaque the guides (rings, grid lines, spokes) are: the foreground, faint. */
export const GUIDE_ALPHA = 0.18;
/** How opaque the shape's outline is: the foreground, stronger than the guides. */
export const OUTLINE_ALPHA = 0.5;
/**
 * How strongly a grid's cell of value 255 is tinted in its label's color over the surface: light,
 * as a grid often covers much of the view (a drivable area) and should not outweigh what is on it.
 */
export const GRID_ALPHA = 0.18;
/** The width of objects' outlines and lines without a style row, CSS px. */
export const LINE_WIDTH = 2;

/** A label's look for one frame. Read, never kept: the next frame may change it. */
export interface LabelLook {
  /** The color as CSS. */
  color: string;
  /** The color as numbers, for the grids' pixels; null where it does not parse. */
  rgb: NeatRgb | null;
  /** The style row's line, when the label has one. */
  style: NeatOverlayLineStyle | null;
  /** The style row's width, or `LINE_WIDTH`. */
  width: number;
}

interface Held extends LabelLook {
  /** The frame it was resolved for. */
  frame: number;
}

/** The dash pattern of a line style, as the video overlays dash theirs. */
export function dashOf(style: NeatOverlayLineStyle | null | undefined): readonly number[] {
  return style === 'dashed' ? DASHED : style === 'dotted' ? DOTTED : SOLID;
}

const SOLID: readonly number[] = [];
const DASHED: readonly number[] = [6, 4];
const DOTTED: readonly number[] = [2, 2];

export class LabelColors {
  private readonly allocator: ColorAllocator;
  private styles: Readonly<Record<string, NeatOverlayClassStyle>> = Object.create(null);
  private overrides: Readonly<Record<string, string>> | undefined;
  /** Each label's look, kept so that a frame allocates nothing for a label seen before. */
  private readonly held = new Map<string, Held>();
  /** Colors resolved to numbers, by CSS text: the palette and the rows, so it stays small. */
  private readonly rgb = new Map<string, NeatRgb | null>();
  private frame = 0;
  private now = 0;

  constructor(colors: NeatOverlayColors) {
    this.allocator = createColorAllocator(colors);
  }

  /** The app's style rows, as the video overlays' class rows. */
  setStyles(rows: readonly NeatOverlayClassStyle[]): void {
    const { styles, overrides } = classStyles(rows);
    this.styles = styles;
    this.overrides = rows.length > 0 ? overrides : undefined;
    this.held.clear();
  }

  /** Starts a frame drawn at `now` (the `performance.now()` clock the tiles draw with). */
  begin(now: number): void {
    this.frame++;
    this.now = now;
  }

  /** `label`'s look this frame, telling the page's class colors that it is in use. */
  of(label: string): LabelLook {
    let held = this.held.get(label);
    if (held?.frame === this.frame) return held;
    const color = resolveColor({
      allocator: this.allocator,
      channelIndex: 0,
      namespace: 'class',
      identity: label,
      overrides: this.overrides,
      now: this.now,
    });
    const row = styleFor(this.styles, label);
    if (!held) {
      held = { frame: 0, color, rgb: null, style: null, width: LINE_WIDTH };
      this.held.set(label, held);
    }
    held.frame = this.frame;
    held.color = color;
    held.rgb = this.resolve(color);
    held.style = row?.style ?? null;
    held.width = row?.width ?? LINE_WIDTH;
    return held;
  }

  /**
   * The color `of` gives `label` with the style rows `rows`, without recording a draw; null while
   * the label holds no class color. A caller follows the page's class colors, which are signals.
   */
  heldColorOf(label: string, rows: readonly NeatOverlayClassStyle[]): string | null {
    return heldColor({
      allocator: this.allocator,
      channelIndex: 0,
      namespace: 'class',
      identity: label,
      overrides: classStyles(rows).overrides,
    });
  }

  private resolve(color: string): NeatRgb | null {
    if (!this.rgb.has(color)) this.rgb.set(color, neatResolveColor(color));
    return this.rgb.get(color) ?? null;
  }
}
