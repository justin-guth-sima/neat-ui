import type { NeatRgb } from '@sima/neat-ui';
import type { Rect } from '../layout';
import type { DiagramTransform } from './context';
import type { Dot } from './dot-model';
import type { EdgeGeometry } from './edge-geometry';

/*
 * The messaging layer's canvas: it draws dots, never decides them. Ported from the Autoware demo's
 * dot layer: one canvas at the device's pixel ratio, each colour's dot drawn once as a sprite and
 * scaled per dot, each edge's samples mapped to the screen only when the transform changes, and
 * nothing allocated per dot. Its owner (`NeatDiagramMessages`) runs the frames.
 */

/**
 * The zoom at which a dot has its nominal radius (the demo's: about its overview fitted to a
 * 1600 px wide page); at other zooms it grows and shrinks with the diagram.
 */
export const REFERENCE_ZOOM = 0.75;

/**
 * A sprite's dot: radius `SPRITE_R` (CSS px), drawn `SPRITE_DETAIL` times finer than the screen,
 * so it stays round when a zoom draws it larger.
 */
const SPRITE_R = 7;
const SPRITE_DETAIL = 4;
/**
 * The demo's white core: at 55 % over the dot, 0.45 of its radius, so a dot reads on its own
 * line's colour in either theme. Worked out as the dot's colour mixed 55 % toward white, the same
 * pixels without a colour of its own.
 */
const CORE_MIX = 0.55;
const CORE_SIZE = 0.45;
/** What a dot drawn at radius r is wide: the sprite's size per unit of its radius. */
const SIZE_PER_RADIUS = 2;

/**
 * Where the diagram's tokens are not set (a host other than `neat-diagram`): its dim (`.dim` in
 * diagram.css) and the cards' corner radius (`--radius` at the kit's 16 px rem).
 */
const DIM_FALLBACK = 0.25;
const RADIUS_FALLBACK = 8;

/** The dots' colours by colour number: 0 the muted colour, 1 to 8 the series. */
export type DotPalette = readonly (NeatRgb | null)[];

/** A static mark at an edge's end (reduced motion): its latest message's time, radius, colour. */
export interface DotMark {
  readonly edge: string;
  at: number;
  r: number;
  colour: number;
}

/** An edge's samples and the same on the screen, for the transform last mapped. */
interface Mapped {
  readonly geometry: EdgeGeometry;
  readonly screen: Float32Array;
}

export class DotCanvas {
  private context: CanvasRenderingContext2D | null = null;
  /** The box (CSS px), from its owner's ResizeObserver, and what the canvas was sized for. */
  private boxWidth = 0;
  private boxHeight = 0;
  private width = 0;
  private height = 0;
  private ratio = 0;
  /** The sprites by colour number, and the palette and ratio they were painted for. */
  private sprites: (HTMLCanvasElement | null)[] = [];
  private palette: DotPalette | null = null;
  private spriteRatio = 0;
  private dim = DIM_FALLBACK;
  private radius = RADIUS_FALLBACK;
  /** Each drawn edge's samples on the screen, mapped from `source` through `k`, `x`, `y`. */
  private readonly mapped = new Map<string, Mapped>();
  private source: ReadonlyMap<string, EdgeGeometry> | null = null;
  private k = NaN;
  private x = NaN;
  private y = NaN;
  /** The globalAlpha set on the context. */
  private alpha = 1;
  private readonly point = { x: 0, y: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    /** Where the theme's tokens are read: the layer's host. */
    private readonly host: HTMLElement,
  ) {}

  /** The box's size in CSS px; the canvas takes it at the next frame. */
  size(width: number, height: number): void {
    this.boxWidth = width;
    this.boxHeight = height;
  }

  /**
   * Starts a frame: the canvas at the box's size and `ratio`, the sprites in the palette (read
   * only once there is a box), each edge of `geometry` mapped through `transform`, and nothing
   * drawn yet. False while there is nothing to draw on (no size, no 2D context).
   */
  begin(
    ratio: number,
    readPalette: () => DotPalette,
    geometry: ReadonlyMap<string, EdgeGeometry>,
    transform: DiagramTransform,
  ): boolean {
    if (this.boxWidth === 0 || this.boxHeight === 0) return false;
    if (this.boxWidth !== this.width || this.boxHeight !== this.height || ratio !== this.ratio) {
      this.width = this.boxWidth;
      this.height = this.boxHeight;
      this.ratio = ratio;
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
    }
    this.context ??= this.canvas.getContext('2d');
    const context = this.context;
    if (!context) return false;
    const palette = readPalette();
    if (palette !== this.palette || ratio !== this.spriteRatio) this.paint(palette, ratio);
    const { k, x, y } = transform;
    if (geometry !== this.source || k !== this.k || x !== this.x || y !== this.y) {
      this.map(geometry, transform);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    return true;
  }

  /**
   * The dots of this frame, `size` times their radius at the reference zoom, those on edges out
   * of `focus` dimmed, behind `covers`. Answers how many it drew.
   */
  drawDots(
    dots: readonly Dot[],
    size: number,
    focus: ReadonlySet<string> | null,
    covers: readonly Rect[],
  ): number {
    const context = this.clip(covers);
    const scale = (size * this.k) / REFERENCE_ZOOM;
    let drawn = 0;
    for (const dot of dots) {
      if (this.sprite(context, dot.edge, dot.t, dot.r * scale, dot.colour, focus)) drawn++;
    }
    context.restore();
    return drawn;
  }

  /**
   * The marks whose time is after `since` and not after `now`, each at its edge's end, its radius
   * short of the end: the end is on the card the edge enters, which would hide half of it.
   */
  drawMarks(
    marks: Iterable<DotMark>,
    since: number,
    now: number,
    size: number,
    focus: ReadonlySet<string> | null,
    covers: readonly Rect[],
  ): number {
    const context = this.clip(covers);
    const scale = (size * this.k) / REFERENCE_ZOOM;
    let drawn = 0;
    for (const mark of marks) {
      if (mark.at <= since || mark.at > now) continue;
      const length = this.mapped.get(mark.edge)?.geometry.length ?? 0;
      const t = length > 0 ? 1 - (mark.r * scale) / this.k / length : 1;
      if (this.sprite(context, mark.edge, t, mark.r * scale, mark.colour, focus)) drawn++;
    }
    context.restore();
    return drawn;
  }

  /**
   * Clips what is drawn next to outside the cards (diagram units, mapped here: there are few),
   * until the context is restored: the dots pass behind the cards they run into and come out of.
   */
  private clip(covers: readonly Rect[]): CanvasRenderingContext2D {
    const context = this.context as CanvasRenderingContext2D;
    context.save();
    context.globalAlpha = this.alpha = 1;
    if (covers.length === 0) return context;
    const { k, x, y } = this;
    context.beginPath();
    context.rect(0, 0, this.width, this.height);
    for (const c of covers)
      context.roundRect(c.x * k + x, c.y * k + y, c.w * k, c.h * k, this.radius * k);
    context.clip('evenodd');
    return context;
  }

  /** One dot of radius `r` (CSS px) at `t` along `edge`; false for an edge not drawn. */
  private sprite(
    context: CanvasRenderingContext2D,
    edge: string,
    t: number,
    r: number,
    colour: number,
    focus: ReadonlySet<string> | null,
  ): boolean {
    const mapped = this.mapped.get(edge);
    const sprite = this.sprites[colour] ?? this.sprites[0];
    if (!mapped || !sprite) return false;
    const at = mapped.geometry.at(t, this.point, mapped.screen);
    const alpha = focus === null || focus.has(edge) ? 1 : this.dim;
    if (alpha !== this.alpha) context.globalAlpha = this.alpha = alpha;
    const size = SIZE_PER_RADIUS * r;
    context.drawImage(sprite, at.x - size / 2, at.y - size / 2, size, size);
    return true;
  }

  /** Maps every edge's samples to the screen: once per layout, pan or zoom, not per frame. */
  private map(geometry: ReadonlyMap<string, EdgeGeometry>, { k, x, y }: DiagramTransform): void {
    if (geometry !== this.source) {
      this.mapped.clear();
      for (const [id, edge] of geometry) {
        this.mapped.set(id, { geometry: edge, screen: new Float32Array(edge.xy.length) });
      }
      this.source = geometry;
    }
    for (const { geometry: edge, screen } of this.mapped.values()) {
      const { xy } = edge;
      for (let i = 0; i < xy.length; i += 2) {
        screen[i] = xy[i] * k + x;
        screen[i + 1] = xy[i + 1] * k + y;
      }
    }
    this.k = k;
    this.x = x;
    this.y = y;
  }

  /**
   * The sprites, painted again only for a new palette (a new colour scheme) or pixel ratio; the
   * dim and the corner radius are read with them, from the same tokens' element.
   */
  private paint(palette: DotPalette, ratio: number): void {
    this.palette = palette;
    this.spriteRatio = ratio;
    const style = getComputedStyle(this.host);
    const dim = parseFloat(style.getPropertyValue('--diagram-dim'));
    this.dim = Number.isFinite(dim) ? dim : DIM_FALLBACK;
    this.radius = pixels(style.getPropertyValue('--radius')) ?? RADIUS_FALLBACK;
    const muted = palette[0];
    this.sprites = palette.map((colour) => {
      const fill = colour ?? muted;
      return fill ? sprite(fill, ratio * SPRITE_DETAIL) : null;
    });
  }
}

/** A dot of `fill` with its core, in a square of 2 `SPRITE_R` CSS px at `ratio` pixels each. */
function sprite(fill: NeatRgb, ratio: number): HTMLCanvasElement {
  const size = 2 * SPRITE_R;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(size * ratio);
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.scale(ratio, ratio);
  const c = size / 2;
  context.fillStyle = css(fill);
  context.beginPath();
  context.arc(c, c, SPRITE_R - 1, 0, 2 * Math.PI);
  context.fill();
  const [red, green, blue] = fill;
  const core = (v: number) => v + (1 - v) * CORE_MIX;
  context.fillStyle = css([core(red), core(green), core(blue)]);
  context.beginPath();
  context.arc(c, c, (SPRITE_R - 1) * CORE_SIZE, 0, 2 * Math.PI);
  context.fill();
  return canvas;
}

/** A resolved theme colour (`neatThemeColors`) as the canvas takes it. */
function css([red, green, blue]: NeatRgb): string {
  const byte = (v: number) => Math.round(v * 255);
  return `rgb(${byte(red)} ${byte(green)} ${byte(blue)})`;
}

/** A length token in px (`8px`) or rem (`0.5rem`) as CSS px; null for anything else. */
function pixels(value: string): number | null {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return null;
  if (value.trim().endsWith('rem')) {
    return n * parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
  }
  return value.trim().endsWith('px') ? n : null;
}
