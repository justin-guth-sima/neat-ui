import type { NeatRgb } from '@sima/neat-ui';
import {
  type BevPlot,
  type BevView,
  boxPlot,
  farthestCorner,
  labelAngle,
  metresText,
  objectCorners,
  plotReach,
  plotRect,
  stepFor,
  spokeLength,
  toScreen,
} from './geometry';
import {
  dashOf,
  GRID_ALPHA,
  type LabelColours,
  type LabelLook,
  OBJECT_FILL_ALPHA,
} from './colours';
import type {
  NeatBevFrame,
  NeatBevGrid,
  NeatBevGuides,
  NeatBevLayer,
  NeatBevLine,
  NeatBevObject,
  NeatBevOverflow,
  NeatBevSpoke,
} from './model';

/*
 * The bird's-eye view's canvas: it draws, never decides. One canvas at the device's pixel ratio.
 * What changes only with the size, the view, the theme or the inputs is drawn into two cached
 * layers: under the data, the app's `background` (and the guides when they go under); over it, the
 * guides (rings or grid lines, spokes, the outline) when they go over, the app's `foreground`, and their
 * labels. What a frame brings (grids, lines, points, objects) is drawn between the two each time,
 * without allocating per item, and the vehicle's marker on top. With `'clip'` the data and the
 * guides are cut at the plot (the circle or the rectangle, zoomed as the view is); with
 * `'visible'` only at the box. Its owner (`NeatBev`) decides when to draw.
 */

/** The theme's colours and the font, as CSS, for what the plot draws itself. */
export interface BevTheme {
  /** Rings, grid lines and spokes: see-through, so that over the data they show on top of it. */
  readonly line: string;
  /** The plot's edge, see-through as the lines are. */
  readonly strong: string;
  /** The labels. */
  readonly text: string;
  /** The vehicle's marker. */
  readonly ego: string;
  /** The surface the plot sits on: the halo around labels and the marker. */
  readonly halo: string;
  /** The surface as numbers, for the grids' backing; null where it does not parse. */
  readonly surface: NeatRgb | null;
  /** The labels' font, as the canvas takes it. */
  readonly font: string;
}

/** What the plot is drawn from, besides a frame: changes rarely, and redraws the cached layers. */
export interface BevInputs {
  readonly plot: BevPlot;
  /** What the app draws under the data, and over it: static lines, polygons and points. */
  readonly background: NeatBevLayer | null;
  readonly foreground: NeatBevLayer | null;
  readonly spokes: readonly Required<NeatBevSpoke>[];
  /** Whether the plot's edge is drawn. */
  readonly outline: boolean;
  readonly overflow: NeatBevOverflow;
  readonly guides: NeatBevGuides;
}

/** Half the side of a point's square, CSS px. */
const POINT_HALF = 1;
/** The vehicle's marker: from its centre to its tip and to its base's corners, CSS px. */
const EGO_TIP = 9;
const EGO_BASE = 6;
/** Where the grid's labels sit from the plot's (or the box's) left and top: CSS px. */
const GRID_LABEL_LEFT = 4;
const GRID_LABEL_TOP = 10;
/** Room the corner keeps free of the top labels, and the left labels keep below the top row. */
const CORNER_WIDTH = 36;
const LABEL_CLEARANCE = 12;
/** The halo around labels, CSS px. */
const HALO_WIDTH = 3;
/** How much wider the hovered object's outline is, CSS px. */
const HOVER_EXTRA = 2;
/** How far inside the box a ring's label must sit to be drawn, CSS px. */
const LABEL_MARGIN = 8;

const NO_FRAME: NeatBevFrame = {};
/** No dash, kept so that drawing allocates no empty array. */
const SOLID = dashOf(null);

/** The points' pixels: a buffer as wide and high as the canvas, as bytes and as 32-bit words. */
interface PointPixels {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly image: ImageData;
  readonly words: Uint32Array;
}

/** One pixel's bytes and the word they make, reused so that packing allocates nothing. */
const PIXEL_BYTES = new Uint8Array(4);
const PIXEL_WORD = new Uint32Array(PIXEL_BYTES.buffer);

/** An opaque colour as one pixel word in the buffer's byte order (RGBA in memory). */
export function packRgb([red, green, blue]: readonly [number, number, number]): number {
  const byte = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255);
  PIXEL_BYTES[0] = byte(red);
  PIXEL_BYTES[1] = byte(green);
  PIXEL_BYTES[2] = byte(blue);
  PIXEL_BYTES[3] = 255;
  return PIXEL_WORD[0];
}

/** A cached layer: its canvas, made at its first use. */
interface Layer {
  canvas: HTMLCanvasElement | null;
  context: CanvasRenderingContext2D | null;
  /** Whether it holds anything this time: an empty layer is not drawn. */
  used: boolean;
}

/**
 * A grid's pixels, kept until its cells, its colour or the surface change: its tint (the label's
 * colour, see-through) and its backing (the surface, as opaque as each cell's value), which is laid
 * first, so that the grid covers what lies under it (guides under the data) while still looking as
 * see-through as its tint over the surface. Every grid's backing goes down before any tint, so
 * overlapping grids still blend.
 */
interface GridCache {
  cells: Uint8Array | null;
  colour: string;
  surface: NeatRgb | null;
  tint: HTMLCanvasElement;
  backing: HTMLCanvasElement;
}

export class BevCanvas {
  private context: CanvasRenderingContext2D | null = null;
  private boxWidth = 0;
  private boxHeight = 0;
  private width = 0;
  private height = 0;
  private ratio = 0;

  /** The cached layers and what they were drawn for. */
  private readonly under: Layer = { canvas: null, context: null, used: false };
  private readonly over: Layer = { canvas: null, context: null, used: false };
  private layerView: BevView | null = null;
  private layerInputs: BevInputs | null = null;
  private layerTheme: BevTheme | null = null;
  private layerRatio = 0;
  private layerWidth = 0;
  private layerHeight = 0;
  /** The colours of the static layers' labels the cached layers were drawn in, in order. */
  private readonly staticColours: string[] = [];
  /** How many times the cached layers were drawn: what the tests of the caching read. */
  layerDraws = 0;

  private readonly grids: GridCache[] = [];
  /** The points' buffer and the canvas it is put on: made once per plot size. */
  private points: PointPixels | null = null;
  private readonly corners = new Float64Array(8);
  /** This frame's labels of objects, in the order they first appear; reused. */
  private readonly labels: string[] = [];
  /** This frame's labels of filled lines, likewise. */
  private readonly areaLabels: string[] = [];
  private readonly point = { x: 0, y: 0 };
  private readonly other = { x: 0, y: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly createCanvas: () => HTMLCanvasElement = () =>
      canvas.ownerDocument.createElement('canvas'),
  ) {}

  /** The box's size in CSS px; the canvas takes it at the next draw. */
  size(width: number, height: number): void {
    this.boxWidth = width;
    this.boxHeight = height;
  }

  /**
   * Draws `frame` between the cached layers in `view`, the object at index `hover` outlined. False
   * while there is nothing to draw on (no size, no 2D context) or nothing to draw (no scale: the
   * canvas is then cleared).
   */
  draw(
    ratio: number,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    colours: LabelColours,
    frame: NeatBevFrame | null,
    hover: number,
  ): boolean {
    if (this.boxWidth <= 0 || this.boxHeight <= 0) return false;
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
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!(view.ppm > 0)) return false;
    const shown = frame ?? NO_FRAME;

    if (this.layerStale(ratio, view, inputs, theme, colours)) {
      this.drawLayers(ratio, view, inputs, theme, colours);
    }

    this.putLayer(context, this.under);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.save();
    this.clip(context, view, inputs);
    this.drawAreas(context, view, shown, colours, theme);
    this.drawLines(context, view, shown, colours);
    this.drawPoints(context, view, shown, colours, inputs);
    this.drawObjects(context, view, shown, colours, hover);
    context.restore();
    this.putLayer(context, this.over);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.save();
    this.clip(context, view, inputs);
    this.drawEgo(context, view, theme);
    context.restore();
    return true;
  }

  /** Copies a cached layer that holds something onto the canvas, pixel for pixel. */
  private putLayer(context: CanvasRenderingContext2D, layer: Layer): void {
    if (!layer.used || !layer.canvas) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(layer.canvas, 0, 0);
  }

  /**
   * Clips to the plot as `view` shows it, zoom included: the circle of the range around the
   * vehicle, or the rectangle. Nothing beyond the box with `'visible'`.
   */
  private clip(context: CanvasRenderingContext2D, view: BevView, inputs: BevInputs): void {
    if (inputs.overflow === 'visible') return;
    this.plotPath(context, view, inputs.plot);
    context.clip();
  }

  /** The plot's edge as the current path: the circle, or the rectangle. */
  private plotPath(context: CanvasRenderingContext2D, view: BevView, plot: BevPlot): void {
    context.beginPath();
    if (plot.shape === 'round') {
      const centre = toScreen(view, 0, 0, this.point);
      const radius = Math.max(0, plot.range * view.ppm * view.k);
      context.arc(centre.x, centre.y, radius, 0, 2 * Math.PI);
    } else {
      const [[x0, y0], [x1, y1]] = plotRect(view, plot);
      context.rect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  private layerStale(
    ratio: number,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    colours: LabelColours,
  ): boolean {
    let stale =
      this.over.canvas === null ||
      ratio !== this.layerRatio ||
      this.width !== this.layerWidth ||
      this.height !== this.layerHeight ||
      inputs !== this.layerInputs ||
      theme !== this.layerTheme ||
      !sameView(view, this.layerView);
    // A static layer's labels keep their class colours alive on the page; a colour that changed
    // (a style row, the theme) redraws.
    let i = 0;
    forEachStaticLabel(inputs, (label) => {
      if (this.staticColours[i++] !== colours.of(label).colour) stale = true;
    });
    return stale || i !== this.staticColours.length;
  }

  private drawLayers(
    ratio: number,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    colours: LabelColours,
  ): void {
    this.layerRatio = ratio;
    this.layerWidth = this.width;
    this.layerHeight = this.height;
    this.layerView = view;
    this.layerInputs = inputs;
    this.layerTheme = theme;
    this.staticColours.length = 0;
    forEachStaticLabel(inputs, (label) => this.staticColours.push(colours.of(label).colour));
    this.layerDraws++;

    const step = stepFor(plotReach(inputs.plot), view);
    const guidesUnder = inputs.guides === 'under';

    this.under.used = inputs.background !== null || guidesUnder;
    const under = this.under.used ? this.prepare(this.under, ratio) : null;
    if (under) {
      this.drawStatic(under, view, inputs, inputs.background, colours);
      if (guidesUnder) this.drawGuides(under, view, inputs, theme, step);
    }

    this.over.used = true;
    const over = this.prepare(this.over, ratio);
    if (!over) return;
    if (!guidesUnder) this.drawGuides(over, view, inputs, theme, step);
    this.drawStatic(over, view, inputs, inputs.foreground, colours);
    // The labels over everything, and not clipped: one on the plot's edge shows whole.
    this.labelStyle(over, theme);
    if (inputs.plot.shape === 'round') this.ringLabels(over, view, inputs, theme, step);
    else this.gridLabels(over, view, inputs, theme, step);
  }

  /** A layer's context, its canvas as large as the main one and cleared; null without 2D. */
  private prepare(layer: Layer, ratio: number): CanvasRenderingContext2D | null {
    layer.canvas ??= this.createCanvas();
    const canvas = layer.canvas;
    if (canvas.width !== this.canvas.width || canvas.height !== this.canvas.height) {
      canvas.width = this.canvas.width;
      canvas.height = this.canvas.height;
    }
    layer.context ??= canvas.getContext('2d');
    const context = layer.context;
    if (!context) {
      layer.used = false;
      return null;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context;
  }

  /**
   * The guides: within the plot, the rings or the grid's lines and the spokes; then the plot's
   * edge, unclipped so that its line shows whole.
   */
  private drawGuides(
    context: CanvasRenderingContext2D,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    step: number,
  ): void {
    context.save();
    this.clip(context, view, inputs);
    if (inputs.plot.shape === 'round') this.drawRings(context, view, inputs, theme, step);
    else this.drawGridLines(context, view, inputs, theme, step);
    this.drawSpokes(context, view, inputs, theme);
    context.restore();
    if (inputs.outline) this.drawOutline(context, view, inputs.plot, theme);
  }

  /**
   * A static layer (`background` or `foreground`), clipped as the data is: its polygons as
   * see-through areas (no backing: over the data it must not hide it), its lines, and its points
   * as small squares, one path a label. It is redrawn only with the cached layers, so it suits
   * what changes rarely and is not too large; a dense cloud belongs in the frame.
   */
  private drawStatic(
    context: CanvasRenderingContext2D,
    view: BevView,
    inputs: BevInputs,
    layer: NeatBevLayer | null,
    colours: LabelColours,
  ): void {
    if (!layer) return;
    context.save();
    this.clip(context, view, inputs);
    if (layer.lines) {
      this.fillPolygons(context, view, layer.lines, colours, '');
      this.drawLines(context, view, layer, colours);
    }
    for (const set of layer.points ?? []) {
      const xy = set.xy;
      context.beginPath();
      for (let i = 0; i + 1 < xy.length; i += 2) {
        const at = toScreen(view, xy[i], xy[i + 1], this.point);
        context.rect(at.x - POINT_HALF, at.y - POINT_HALF, 2 * POINT_HALF, 2 * POINT_HALF);
      }
      context.fillStyle = colours.of(set.label).colour;
      context.fill();
    }
    context.restore();
  }

  /**
   * The rings, every `step` from the vehicle: inside the range with `'clip'`, on to the box's
   * farthest corner with `'visible'`. The range's own ring is the outline.
   */
  private drawRings(
    context: CanvasRenderingContext2D,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    step: number,
  ): void {
    const scale = view.ppm * view.k;
    const centre = toScreen(view, 0, 0, this.point);
    const last = this.ringLimit(view, inputs);
    context.lineWidth = 1;
    context.setLineDash(SOLID);
    context.strokeStyle = theme.line;
    context.beginPath();
    for (let r = step; r < last - step * 1e-6; r += step) {
      context.moveTo(centre.x + r * scale, centre.y);
      context.arc(centre.x, centre.y, r * scale, 0, 2 * Math.PI);
    }
    context.stroke();
  }

  /** How far the rings go, metres: the range, or (visible) past the box's farthest corner. */
  private ringLimit(view: BevView, inputs: BevInputs): number {
    const { plot } = inputs;
    if (inputs.overflow === 'clip') return plot.range;
    return farthestCorner(boxPlot(view, this.width, this.height, plot.range)) + 1;
  }

  /**
   * Each ring's distance where it crosses the labels' direction (`labelAngle`), while that point is
   * in the box: up to the range with `'clip'`, every ring with `'visible'`.
   */
  private ringLabels(
    context: CanvasRenderingContext2D,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    step: number,
  ): void {
    const { range } = inputs.plot;
    const angle = labelAngle(view, this.width, this.height);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const last = inputs.overflow === 'clip' ? range + step * 1e-6 : this.ringLimit(view, inputs);
    for (let r = step; r <= last; r += step) {
      const at = toScreen(view, r * cos, r * sin, this.other);
      if (
        at.x < LABEL_MARGIN ||
        at.y < LABEL_MARGIN ||
        at.x > this.width - LABEL_MARGIN ||
        at.y > this.height - LABEL_MARGIN
      ) {
        continue;
      }
      this.label(context, metresText(r), at.x, at.y, theme);
    }
  }

  /**
   * Where the grid and the points are drawn, CSS px (left, top, right, bottom): the plot's
   * rectangle within the box with `'clip'`, the box with `'visible'`.
   */
  private region(view: BevView, inputs: BevInputs): readonly [number, number, number, number] {
    if (inputs.overflow === 'visible') return [0, 0, this.width, this.height];
    const [[x0, y0], [x1, y1]] = plotRect(view, inputs.plot);
    return [Math.max(0, x0), Math.max(0, y0), Math.min(this.width, x1), Math.min(this.height, y1)];
  }

  /** The grid's lines through `region`, every `step` from the vehicle in both directions. */
  private gridSpan(
    view: BevView,
    step: number,
    [left, top, right, bottom]: readonly [number, number, number, number],
  ): readonly [number, number, number, number] {
    const scale = view.ppm * view.k;
    const centre = toScreen(view, 0, 0, this.point);
    return [
      Math.ceil((centre.y - bottom) / scale / step - 1e-9),
      Math.floor((centre.y - top) / scale / step + 1e-9),
      Math.ceil((centre.x - right) / scale / step - 1e-9),
      Math.floor((centre.x - left) / scale / step + 1e-9),
    ];
  }

  private drawGridLines(
    context: CanvasRenderingContext2D,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    step: number,
  ): void {
    const scale = view.ppm * view.k;
    const region = this.region(view, inputs);
    const [left, top, right, bottom] = region;
    if (right <= left || bottom <= top) return;
    const [lowX, highX, lowY, highY] = this.gridSpan(view, step, region);
    const centre = toScreen(view, 0, 0, this.point);
    context.lineWidth = 1;
    context.setLineDash(SOLID);
    context.strokeStyle = theme.line;
    context.beginPath();
    for (let n = lowX; n <= highX; n++) {
      const y = centre.y - n * step * scale;
      context.moveTo(left, y);
      context.lineTo(right, y);
    }
    for (let n = lowY; n <= highY; n++) {
      const x = centre.x - n * step * scale;
      context.moveTo(x, top);
      context.lineTo(x, bottom);
    }
    context.stroke();
  }

  /**
   * The lines' distances from the vehicle: forward and back along the grid's left edge, left and
   * right along its top (the box's where the plot's edge is out of it), leaving the corner where
   * the two would meet to neither.
   */
  private gridLabels(
    context: CanvasRenderingContext2D,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    step: number,
  ): void {
    const scale = view.ppm * view.k;
    const region = this.region(view, inputs);
    const [left, top, right, bottom] = region;
    if (right <= left || bottom <= top) return;
    const [lowX, highX, lowY, highY] = this.gridSpan(view, step, region);
    const centre = toScreen(view, 0, 0, this.point);
    const column = left + GRID_LABEL_LEFT;
    const row = top + GRID_LABEL_TOP;
    context.textAlign = 'left';
    for (let n = lowX; n <= highX; n++) {
      const y = centre.y - n * step * scale;
      if (n === 0 || y < row + LABEL_CLEARANCE || y > bottom - GRID_LABEL_TOP) continue;
      this.label(context, metresText(Math.abs(n * step)), column, y, theme);
    }
    context.textAlign = 'center';
    for (let n = lowY; n <= highY; n++) {
      const x = centre.x - n * step * scale;
      if (n === 0 || x < column + CORNER_WIDTH || x > right - CORNER_WIDTH / 2) continue;
      this.label(context, metresText(Math.abs(n * step)), x, row, theme);
    }
    context.textAlign = 'center';
  }

  private drawSpokes(
    context: CanvasRenderingContext2D,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
  ): void {
    context.lineWidth = 1;
    context.setLineDash(SOLID);
    context.strokeStyle = theme.line;
    context.beginPath();
    // To the plot's edge, or with `'visible'` to the box's.
    const plot =
      inputs.overflow === 'visible'
        ? boxPlot(view, this.width, this.height, inputs.plot.range)
        : inputs.plot;
    for (const { angle, origin } of inputs.spokes) {
      const length = spokeLength(origin, angle, plot);
      if (length <= 0) continue;
      const from = toScreen(view, origin.x, origin.y, this.point);
      context.moveTo(from.x, from.y);
      const end = toScreen(
        view,
        origin.x + length * Math.cos(angle),
        origin.y + length * Math.sin(angle),
        this.other,
      );
      context.lineTo(end.x, end.y);
    }
    context.stroke();
  }

  /** The plot's edge, the circle or the rectangle, zoomed and panned as the view is. */
  private drawOutline(
    context: CanvasRenderingContext2D,
    view: BevView,
    plot: BevPlot,
    theme: BevTheme,
  ): void {
    context.lineWidth = 1;
    context.setLineDash(SOLID);
    context.strokeStyle = theme.strong;
    this.plotPath(context, view, plot);
    context.stroke();
  }

  private labelStyle(context: CanvasRenderingContext2D, theme: BevTheme): void {
    context.font = theme.font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.lineWidth = HALO_WIDTH;
  }

  private label(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    theme: BevTheme,
  ): void {
    context.strokeStyle = theme.halo;
    context.strokeText(text, x, y);
    context.fillStyle = theme.text;
    context.fillText(text, x, y);
  }

  /**
   * The areas, the grids and the filled lines: every backing first, then every tint (`GridCache`),
   * so an area covers what lies under it and overlapping areas still blend.
   */
  private drawAreas(
    context: CanvasRenderingContext2D,
    view: BevView,
    frame: NeatBevFrame,
    colours: LabelColours,
    theme: BevTheme,
  ): void {
    const { grids, lines } = frame;
    const count = grids?.length ?? 0;
    this.grids.length = Math.min(this.grids.length, count);
    for (const layer of ['backing', 'tint'] as const) {
      if (lines && (layer === 'tint' || theme.surface)) {
        this.fillPolygons(context, view, lines, layer === 'tint' ? colours : null, theme.halo);
      }
      if (!grids) continue;
      context.imageSmoothingEnabled = false;
      for (let i = 0; i < count; i++) {
        const grid = grids[i];
        if (grid.columns <= 0 || grid.rows <= 0 || grid.cells.length < grid.columns * grid.rows) {
          continue;
        }
        const cached =
          layer === 'backing'
            ? this.gridCanvases(i, grid, colours.of(grid.label), theme.surface)
            : this.grids[i];
        // No backing without a surface to lay: the tint alone, see-through as before.
        if (!cached || (layer === 'backing' && !cached.surface)) continue;
        const corner = toScreen(view, grid.x[1], grid.y[1], this.point);
        const opposite = toScreen(view, grid.x[0], grid.y[0], this.other);
        const image = cached[layer];
        context.drawImage(image, corner.x, corner.y, opposite.x - corner.x, opposite.y - corner.y);
      }
      context.imageSmoothingEnabled = true;
    }
  }

  /**
   * The filled lines, a label at a time: each label's polygons are one path, every polygon wound
   * the same way, so that where they overlap the nonzero rule fills their union once (a road
   * network given as pieces shows no darker joins). With `colours`, the tint in each label's
   * colour; without, the backing in `surface`.
   */
  private fillPolygons(
    context: CanvasRenderingContext2D,
    view: BevView,
    lines: readonly NeatBevLine[],
    colours: LabelColours | null,
    surface: string,
  ): void {
    const labels = this.areaLabels;
    labels.length = 0;
    for (const line of lines) {
      if (line.fill && line.xy.length >= 6 && !labels.includes(line.label)) labels.push(line.label);
    }
    if (labels.length === 0) return;
    context.globalAlpha = colours ? GRID_ALPHA : 1;
    for (const label of labels) {
      context.beginPath();
      for (const line of lines) {
        if (!line.fill || line.label !== label || line.xy.length < 6) continue;
        this.addPolygon(context, view, line.xy);
      }
      context.fillStyle = colours ? colours.of(label).colour : surface;
      context.fill('nonzero');
    }
    context.globalAlpha = 1;
  }

  /** Adds a closed polygon to the current path, wound counter-clockwise in metres. */
  private addPolygon(context: CanvasRenderingContext2D, view: BevView, xy: Float32Array): void {
    const pairs = xy.length >> 1;
    const reversed = signedArea(xy) < 0;
    for (let k = 0; k < pairs; k++) {
      const i = 2 * (reversed ? pairs - 1 - k : k);
      const at = toScreen(view, xy[i], xy[i + 1], this.point);
      if (k === 0) context.moveTo(at.x, at.y);
      else context.lineTo(at.x, at.y);
    }
    context.closePath();
  }

  /** A line's points as the current path, closed when asked. */
  private linePath(
    context: CanvasRenderingContext2D,
    view: BevView,
    xy: Float32Array,
    closed: boolean,
  ): void {
    context.beginPath();
    for (let i = 0; i + 1 < xy.length; i += 2) {
      const at = toScreen(view, xy[i], xy[i + 1], this.point);
      if (i === 0) context.moveTo(at.x, at.y);
      else context.lineTo(at.x, at.y);
    }
    if (closed) context.closePath();
  }

  /**
   * The grid's tint and backing at one pixel per cell, painted again only for new cells, a new
   * colour or a new surface; null where the colour does not parse or there is no 2D context.
   */
  private gridCanvases(
    index: number,
    grid: NeatBevGrid,
    look: LabelLook,
    surface: NeatRgb | null,
  ): GridCache | null {
    let cache: GridCache | undefined = this.grids[index];
    if (!cache) {
      cache = {
        cells: null,
        colour: '',
        surface: null,
        tint: this.createCanvas(),
        backing: this.createCanvas(),
      };
      this.grids[index] = cache;
    }
    if (
      cache.cells === grid.cells &&
      cache.colour === look.colour &&
      sameRgb(cache.surface, surface)
    ) {
      return cache;
    }
    cache.cells = null;
    if (!look.rgb) return null;
    if (!this.paintGrid(cache.tint, grid, look.rgb, GRID_ALPHA)) return null;
    if (surface && !this.paintGrid(cache.backing, grid, surface, 1)) return null;
    cache.cells = grid.cells;
    cache.colour = look.colour;
    cache.surface = surface;
    return cache;
  }

  /** Paints `grid`'s cells in `rgb`, each as opaque as its value times `alpha`. */
  private paintGrid(
    canvas: HTMLCanvasElement,
    grid: NeatBevGrid,
    [red, green, blue]: NeatRgb,
    alpha: number,
  ): boolean {
    canvas.width = grid.columns;
    canvas.height = grid.rows;
    const context = canvas.getContext('2d');
    if (!context) return false;
    const image = context.createImageData(grid.columns, grid.rows);
    const data = image.data;
    const cells = grid.cells;
    for (let i = 0; i < grid.columns * grid.rows; i++) {
      const value = cells[i];
      if (value === 0) continue;
      const o = i * 4;
      data[o] = red * 255;
      data[o + 1] = green * 255;
      data[o + 2] = blue * 255;
      data[o + 3] = value * alpha;
    }
    context.putImageData(image, 0, 0);
    return true;
  }

  private drawLines(
    context: CanvasRenderingContext2D,
    view: BevView,
    frame: Pick<NeatBevFrame, 'lines'>,
    colours: LabelColours,
  ): void {
    const lines = frame.lines;
    if (!lines) return;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    for (const line of lines) {
      const xy = line.xy;
      // A filled line is an area, drawn with the grids, and has no outline of its own.
      if (xy.length < 4 || line.fill) continue;
      const look = colours.of(line.label);
      context.strokeStyle = look.colour;
      context.lineWidth = look.width;
      context.setLineDash(dashOf(look.style ?? line.style));
      this.linePath(context, view, xy, line.closed === true);
      context.stroke();
    }
    context.setLineDash(SOLID);
  }

  private drawPoints(
    context: CanvasRenderingContext2D,
    view: BevView,
    frame: NeatBevFrame,
    colours: LabelColours,
    inputs: BevInputs,
  ): void {
    const sets = frame.points;
    if (!sets?.some((set) => set.xy.length >= 2)) return;
    // The buffer covers the plot's rectangle within the box (with `'visible'`, the box) in device
    // pixels, so a wide box clears and copies no more than it shows points in.
    const ratio = this.ratio;
    const [x0, y0, x1, y1] = this.region(view, inputs);
    const left = Math.max(0, Math.floor(x0 * ratio));
    const top = Math.max(0, Math.floor(y0 * ratio));
    const right = Math.min(this.canvas.width, Math.ceil(x1 * ratio));
    const bottom = Math.min(this.canvas.height, Math.ceil(y1 * ratio));
    if (right <= left || bottom <= top) return;
    const pixels = this.pointPixels(right - left, bottom - top);
    if (!pixels) return;
    const { image, words, canvas, context: pointsContext } = pixels;
    const width = image.width;
    const height = image.height;
    words.fill(0);
    // The mapping written out, as a cloud has tens of thousands of points, in the buffer's device
    // pixels: each point a square of whole pixels written straight into the buffer. Canvas calls
    // per point (one path of many rects, or a fillRect each) cost far more to rasterise, with a
    // GPU or without (the bench's BEV page measured the path at 20 fps, this buffer at 60).
    const scale = view.ppm * view.k * ratio;
    const ox = (view.tx + view.k * view.cx) * ratio - left;
    const oy = (view.ty + view.k * view.cy) * ratio - top;
    const side = Math.max(1, Math.round(POINT_HALF * 2 * ratio));
    const half = side >> 1;
    for (const set of sets) {
      const xy = set.xy;
      const rgb = colours.of(set.label).rgb;
      if (xy.length < 2 || !rgb) continue;
      const word = packRgb(rgb);
      for (let i = 0; i + 1 < xy.length; i += 2) {
        const x = Math.round(ox - xy[i + 1] * scale) - half;
        const y = Math.round(oy - xy[i] * scale) - half;
        if (x >= width || y >= height || x + side <= 0 || y + side <= 0) continue;
        const x0 = Math.max(0, x);
        const x1 = Math.min(width, x + side);
        const y1 = Math.min(height, y + side);
        for (let row = Math.max(0, y); row < y1; row++) {
          words.fill(word, row * width + x0, row * width + x1);
        }
      }
    }
    pointsContext.putImageData(image, 0, 0);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(canvas, left, top);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /**
   * The points' pixel buffer, `width` × `height`, made again only when its size changes. Its canvas
   * is kept in memory (`willReadFrequently`), so putting the buffer on it is a copy, not an upload
   * to the GPU every frame (the bench measured 56 to 59 fps with an upload, 60 without).
   */
  private pointPixels(width: number, height: number): PointPixels | null {
    const held = this.points;
    if (held && held.image.width === width && held.image.height === height) return held;
    const canvas = held?.canvas ?? this.createCanvas();
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || width === 0 || height === 0) return null;
    const image = context.createImageData(width, height);
    this.points = { canvas, context, image, words: new Uint32Array(image.data.buffer) };
    return this.points;
  }

  /**
   * The objects, a label at a time in the order the labels first appear: one path holds all of a
   * label's boxes, filled once and outlined once, and one more its headings, so a frame makes a few
   * calls per label instead of several per object. Where boxes of two labels overlap, the label
   * that appeared later is on top.
   */
  private drawObjects(
    context: CanvasRenderingContext2D,
    view: BevView,
    frame: NeatBevFrame,
    colours: LabelColours,
    hover: number,
  ): void {
    const objects = frame.objects;
    if (!objects?.length) return;
    const labels = this.labels;
    labels.length = 0;
    for (const object of objects) if (!labels.includes(object.label)) labels.push(object.label);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    for (const label of labels) {
      const look = colours.of(label);
      context.beginPath();
      for (const object of objects) if (object.label === label) this.addBox(context, view, object);
      context.fillStyle = look.colour;
      context.globalAlpha = OBJECT_FILL_ALPHA;
      context.fill();
      context.globalAlpha = 1;
      context.strokeStyle = look.colour;
      context.lineWidth = look.width;
      context.setLineDash(dashOf(look.style));
      context.stroke();
      // The headings: from each centre to the middle of its front edge.
      context.setLineDash(SOLID);
      context.beginPath();
      for (const object of objects) {
        if (object.label === label) this.addHeading(context, view, object);
      }
      context.stroke();
    }
    const hovered = objects[hover];
    if (hovered) {
      const look = colours.of(hovered.label);
      context.beginPath();
      this.addBox(context, view, hovered);
      context.strokeStyle = look.colour;
      context.lineWidth = look.width + HOVER_EXTRA;
      context.setLineDash(SOLID);
      context.stroke();
    }
  }

  /** Adds the object's outline to the current path. */
  private addBox(context: CanvasRenderingContext2D, view: BevView, object: NeatBevObject): void {
    const c = objectCorners(object, this.corners);
    for (let k = 0; k < 4; k++) {
      const at = toScreen(view, c[2 * k], c[2 * k + 1], this.point);
      if (k === 0) context.moveTo(at.x, at.y);
      else context.lineTo(at.x, at.y);
    }
    context.closePath();
  }

  /** Adds the object's heading, from its centre to the middle of its front edge, to the path. */
  private addHeading(
    context: CanvasRenderingContext2D,
    view: BevView,
    object: NeatBevObject,
  ): void {
    const c = objectCorners(object, this.corners);
    const centre = toScreen(view, object.x, object.y, this.point);
    context.moveTo(centre.x, centre.y);
    const front = toScreen(view, (c[0] + c[2]) / 2, (c[1] + c[3]) / 2, this.other);
    context.lineTo(front.x, front.y);
  }

  private drawEgo(context: CanvasRenderingContext2D, view: BevView, theme: BevTheme): void {
    const at = toScreen(view, 0, 0, this.point);
    context.beginPath();
    context.moveTo(at.x, at.y - EGO_TIP);
    context.lineTo(at.x - EGO_BASE, at.y + EGO_BASE);
    context.lineTo(at.x + EGO_BASE, at.y + EGO_BASE);
    context.closePath();
    context.fillStyle = theme.ego;
    context.strokeStyle = theme.halo;
    context.lineWidth = 1.5;
    context.setLineDash(SOLID);
    context.fill();
    context.stroke();
  }
}

/** Twice a polygon's signed area (x, y pairs): positive when wound counter-clockwise. */
function signedArea(xy: Float32Array): number {
  let sum = 0;
  for (let i = 0, j = xy.length - 2; i + 1 < xy.length; j = i, i += 2) {
    sum += xy[j] * xy[i + 1] - xy[i] * xy[j + 1];
  }
  return sum;
}

/** Calls `visit` with each label of the static layers' lines and points, in order. */
function forEachStaticLabel(inputs: BevInputs, visit: (label: string) => void): void {
  for (const layer of [inputs.background, inputs.foreground]) {
    if (!layer) continue;
    for (const line of layer.lines ?? []) visit(line.label);
    for (const set of layer.points ?? []) visit(set.label);
  }
}

function sameRgb(a: NeatRgb | null, b: NeatRgb | null): boolean {
  return a === b || (a !== null && b !== null && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);
}

function sameView(a: BevView, b: BevView | null): boolean {
  return (
    b !== null &&
    a.cx === b.cx &&
    a.cy === b.cy &&
    a.ppm === b.ppm &&
    a.k === b.k &&
    a.tx === b.tx &&
    a.ty === b.ty
  );
}
