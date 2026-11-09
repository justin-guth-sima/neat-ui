import {
  canvasAngle,
  LABEL_ANGLE,
  type BevView,
  metresText,
  objectCorners,
  PLOT_INSET,
  plotArea,
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
  SENSOR_FILL_ALPHA,
} from './colours';
import type {
  NeatBevFrame,
  NeatBevGrid,
  NeatBevObject,
  NeatBevSensor,
  NeatBevShape,
  NeatBevSpoke,
} from './model';

/*
 * The bird's-eye view's canvas: it draws, never decides. One canvas at the device's pixel ratio.
 * What changes only with the size, the view, the theme or the inputs (sensor wedges, rings or grid
 * lines, spokes, their labels) is drawn into a cached layer; what a frame brings (grids, lines,
 * points, objects) is drawn over it each time, without allocating per item. Its owner (`NeatBev`)
 * decides when to draw.
 */

/** The theme's colours and the font, as CSS, for what the plot draws itself. */
export interface BevTheme {
  /** Rings, grid lines and spokes. */
  readonly line: string;
  /** The plot's edge and the range's ring. */
  readonly strong: string;
  /** The labels. */
  readonly text: string;
  /** The vehicle's marker. */
  readonly ego: string;
  /** The surface the plot sits on: the halo around labels and the marker. */
  readonly halo: string;
  /** The labels' font, as the canvas takes it. */
  readonly font: string;
}

/** What the plot is drawn from, besides a frame: changes rarely, and redraws the cached layer. */
export interface BevInputs {
  readonly shape: NeatBevShape;
  readonly range: number;
  readonly sensors: readonly NeatBevSensor[];
  readonly spokes: readonly Required<NeatBevSpoke>[];
}

/** Half the side of a point's square, CSS px. */
const POINT_HALF = 1;
/** The vehicle's marker: from its centre to its tip and to its base's corners, CSS px. */
const EGO_TIP = 9;
const EGO_BASE = 6;
/** Where the square grid's labels sit: their left edge and their middle, CSS px. */
const GRID_LABEL_LEFT = 4;
const GRID_LABEL_TOP = 10;
/** Room the corner keeps free of the top labels, and the left labels keep below the top row. */
const CORNER_WIDTH = 36;
const LABEL_CLEARANCE = 12;
/** The halo around labels, CSS px. */
const HALO_WIDTH = 3;
/** How much wider the hovered object's outline is, CSS px. */
const HOVER_EXTRA = 2;

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

/** A grid's pixels, kept until its cells or its colour change. */
interface GridCache {
  cells: Uint8Array | null;
  colour: string;
  canvas: HTMLCanvasElement;
}

export class BevCanvas {
  private context: CanvasRenderingContext2D | null = null;
  private boxWidth = 0;
  private boxHeight = 0;
  private width = 0;
  private height = 0;
  private ratio = 0;

  /** The cached layer and what it was drawn for. */
  private layer: HTMLCanvasElement | null = null;
  private layerContext: CanvasRenderingContext2D | null = null;
  private layerView: BevView | null = null;
  private layerInputs: BevInputs | null = null;
  private layerTheme: BevTheme | null = null;
  private layerRatio = 0;
  private layerWidth = 0;
  private layerHeight = 0;
  /** The sensors' colours the layer was drawn in, by index. */
  private readonly sensorColours: string[] = [];
  /** How many times the cached layer was drawn: what the tests of the caching read. */
  layerDraws = 0;

  private readonly grids: GridCache[] = [];
  /** The points' buffer and the canvas it is put on: made once per plot size. */
  private points: PointPixels | null = null;
  private readonly corners = new Float64Array(8);
  /** This frame's labels of objects, in the order they first appear; reused. */
  private readonly labels: string[] = [];
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
   * Draws `frame` over the cached layer in `view`, the object at index `hover` outlined. False
   * while there is nothing to draw on (no size, no 2D context, no scale).
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
    if (this.boxWidth <= 0 || this.boxHeight <= 0 || view.ppm <= 0) return false;
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
    const shown = frame ?? NO_FRAME;

    if (this.layerStale(ratio, view, inputs, theme, colours)) {
      this.drawLayer(ratio, view, inputs, theme, colours);
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.save();
    this.clip(context, inputs.shape);
    this.drawGrids(context, view, shown.grids, colours);
    context.restore();

    if (this.layer) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(this.layer, 0, 0);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    context.save();
    this.clip(context, inputs.shape);
    this.drawLines(context, view, shown, colours);
    this.drawPoints(context, view, shown, colours, inputs.shape);
    this.drawObjects(context, view, shown, colours, hover);
    this.drawEgo(context, view, theme);
    context.restore();
    return true;
  }

  /** Clips to the plot: the range's circle at the default zoom (round), or the box (square). */
  private clip(context: CanvasRenderingContext2D, shape: NeatBevShape): void {
    context.beginPath();
    if (shape === 'round') {
      const area = plotArea(this.width, this.height, shape);
      const radius = Math.max(0, area.halfWidth - PLOT_INSET);
      context.arc(area.cx, area.cy, radius, 0, 2 * Math.PI);
    } else {
      context.rect(0, 0, this.width, this.height);
    }
    context.clip();
  }

  private layerStale(
    ratio: number,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    colours: LabelColours,
  ): boolean {
    let stale =
      this.layer === null ||
      ratio !== this.layerRatio ||
      this.width !== this.layerWidth ||
      this.height !== this.layerHeight ||
      inputs !== this.layerInputs ||
      theme !== this.layerTheme ||
      !sameView(view, this.layerView);
    // A sensor's label keeps its class colour alive on the page; a colour that changed redraws.
    const sensors = inputs.sensors;
    for (let i = 0; i < sensors.length; i++) {
      const colour = colours.of(sensors[i].label).colour;
      if (this.sensorColours[i] !== colour) stale = true;
    }
    return stale;
  }

  private drawLayer(
    ratio: number,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    colours: LabelColours,
  ): void {
    this.layer ??= this.createCanvas();
    const layer = this.layer;
    if (layer.width !== this.canvas.width || layer.height !== this.canvas.height) {
      layer.width = this.canvas.width;
      layer.height = this.canvas.height;
    }
    this.layerContext ??= layer.getContext('2d');
    const context = this.layerContext;
    this.layerRatio = ratio;
    this.layerWidth = this.width;
    this.layerHeight = this.height;
    this.layerView = view;
    this.layerInputs = inputs;
    this.layerTheme = theme;
    this.sensorColours.length = 0;
    for (const sensor of inputs.sensors) this.sensorColours.push(colours.of(sensor.label).colour);
    if (!context) return;
    this.layerDraws++;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, layer.width, layer.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const step = stepFor(inputs.range, view);
    context.save();
    this.clip(context, inputs.shape);
    this.drawSensors(context, view, inputs, colours);
    if (inputs.shape === 'round') this.drawRings(context, view, inputs, theme, step);
    else this.drawGridLines(context, view, theme, step);
    this.drawSpokes(context, view, inputs, theme);
    context.restore();
    // The labels over the lines and spokes, and not clipped: one on the edge shows whole.
    this.labelStyle(context, theme);
    if (inputs.shape === 'round') {
      this.drawEdge(context, theme);
      this.ringLabels(context, view, inputs, theme, step);
    } else {
      this.gridLabels(context, view, theme, step);
    }
  }

  private drawSensors(
    context: CanvasRenderingContext2D,
    view: BevView,
    inputs: BevInputs,
    colours: LabelColours,
  ): void {
    const scale = view.ppm * view.k;
    context.globalAlpha = SENSOR_FILL_ALPHA;
    for (const sensor of inputs.sensors) {
      const origin = toScreen(view, sensor.origin?.x ?? 0, sensor.origin?.y ?? 0, this.point);
      const reach = (sensor.range ?? inputs.range) * scale;
      if (!(reach > 0)) continue;
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      // Counter-clockwise from `from` to `to` around the vehicle is anticlockwise on the screen.
      context.arc(
        origin.x,
        origin.y,
        reach,
        canvasAngle(sensor.from),
        canvasAngle(sensor.to),
        true,
      );
      context.closePath();
      context.fillStyle = colours.of(sensor.label).colour;
      context.fill();
    }
    context.globalAlpha = 1;
  }

  private drawRings(
    context: CanvasRenderingContext2D,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    step: number,
  ): void {
    const { range } = inputs;
    const scale = view.ppm * view.k;
    const centre = toScreen(view, 0, 0, this.point);
    context.lineWidth = 1;
    context.setLineDash(SOLID);
    context.strokeStyle = theme.line;
    context.beginPath();
    for (let r = step; r < range - step * 1e-6; r += step) {
      context.moveTo(centre.x + r * scale, centre.y);
      context.arc(centre.x, centre.y, r * scale, 0, 2 * Math.PI);
    }
    context.stroke();
    context.strokeStyle = theme.strong;
    context.beginPath();
    context.arc(centre.x, centre.y, range * scale, 0, 2 * Math.PI);
    context.stroke();
  }

  /** Each ring's distance, halfway between forward and left, where it falls on the plot. */
  private ringLabels(
    context: CanvasRenderingContext2D,
    view: BevView,
    inputs: BevInputs,
    theme: BevTheme,
    step: number,
  ): void {
    const area = plotArea(this.width, this.height, 'round');
    const radius = area.halfWidth - PLOT_INSET;
    const cos = Math.cos(LABEL_ANGLE);
    const sin = Math.sin(LABEL_ANGLE);
    for (let r = step; r <= inputs.range + step * 1e-6; r += step) {
      const at = toScreen(view, r * cos, r * sin, this.other);
      if (Math.hypot(at.x - area.cx, at.y - area.cy) > radius + 1) continue;
      this.label(context, metresText(Math.min(r, inputs.range)), at.x, at.y, theme);
    }
  }

  /** The grid's lines through the box, every `step` from the vehicle in both directions. */
  private gridSpan(view: BevView, step: number): readonly [number, number, number, number] {
    const scale = view.ppm * view.k;
    const centre = toScreen(view, 0, 0, this.point);
    return [
      Math.ceil((centre.y - this.height) / scale / step),
      Math.floor(centre.y / scale / step),
      Math.ceil((centre.x - this.width) / scale / step),
      Math.floor(centre.x / scale / step),
    ];
  }

  private drawGridLines(
    context: CanvasRenderingContext2D,
    view: BevView,
    theme: BevTheme,
    step: number,
  ): void {
    const scale = view.ppm * view.k;
    const [lowX, highX, lowY, highY] = this.gridSpan(view, step);
    const centre = toScreen(view, 0, 0, this.point);
    context.lineWidth = 1;
    context.setLineDash(SOLID);
    context.strokeStyle = theme.line;
    context.beginPath();
    for (let n = lowX; n <= highX; n++) {
      const y = centre.y - n * step * scale;
      context.moveTo(0, y);
      context.lineTo(this.width, y);
    }
    for (let n = lowY; n <= highY; n++) {
      const x = centre.x - n * step * scale;
      context.moveTo(x, 0);
      context.lineTo(x, this.height);
    }
    context.stroke();
  }

  /**
   * The lines' distances from the vehicle: forward and back along the left edge, left and right
   * along the top, leaving the corner where the two would meet to neither.
   */
  private gridLabels(
    context: CanvasRenderingContext2D,
    view: BevView,
    theme: BevTheme,
    step: number,
  ): void {
    const scale = view.ppm * view.k;
    const [lowX, highX, lowY, highY] = this.gridSpan(view, step);
    const centre = toScreen(view, 0, 0, this.point);
    context.textAlign = 'left';
    for (let n = lowX; n <= highX; n++) {
      const y = centre.y - n * step * scale;
      if (n === 0 || y < GRID_LABEL_TOP + LABEL_CLEARANCE) continue;
      this.label(context, metresText(Math.abs(n * step)), GRID_LABEL_LEFT, y, theme);
    }
    context.textAlign = 'center';
    for (let n = lowY; n <= highY; n++) {
      const x = centre.x - n * step * scale;
      if (n === 0 || x < GRID_LABEL_LEFT + CORNER_WIDTH) continue;
      this.label(context, metresText(Math.abs(n * step)), x, GRID_LABEL_TOP, theme);
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
    for (const { angle, origin } of inputs.spokes) {
      const length = spokeLength(origin, angle, inputs.shape, inputs.range);
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

  /** The round plot's edge, which stays put while the view zooms and pans. */
  private drawEdge(context: CanvasRenderingContext2D, theme: BevTheme): void {
    const area = plotArea(this.width, this.height, 'round');
    const radius = area.halfWidth - PLOT_INSET;
    if (radius <= 0) return;
    context.lineWidth = 1;
    context.setLineDash(SOLID);
    context.strokeStyle = theme.strong;
    context.beginPath();
    context.arc(area.cx, area.cy, radius, 0, 2 * Math.PI);
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

  private drawGrids(
    context: CanvasRenderingContext2D,
    view: BevView,
    grids: readonly NeatBevGrid[] | undefined,
    colours: LabelColours,
  ): void {
    const count = grids?.length ?? 0;
    this.grids.length = Math.min(this.grids.length, count);
    if (!grids) return;
    context.imageSmoothingEnabled = false;
    for (let i = 0; i < count; i++) {
      const grid = grids[i];
      if (grid.columns <= 0 || grid.rows <= 0 || grid.cells.length < grid.columns * grid.rows) {
        continue;
      }
      const look = colours.of(grid.label);
      const cached = this.gridCanvas(i, grid, look);
      if (!cached) continue;
      const corner = toScreen(view, grid.x[1], grid.y[1], this.point);
      const opposite = toScreen(view, grid.x[0], grid.y[0], this.other);
      context.drawImage(cached, corner.x, corner.y, opposite.x - corner.x, opposite.y - corner.y);
    }
    context.imageSmoothingEnabled = true;
  }

  /** The grid's pixels at one per cell, painted again only for new cells or a new colour. */
  private gridCanvas(index: number, grid: NeatBevGrid, look: LabelLook): HTMLCanvasElement | null {
    let cache: GridCache | undefined = this.grids[index];
    if (!cache) {
      cache = { cells: null, colour: '', canvas: this.createCanvas() };
      this.grids[index] = cache;
    }
    if (cache.cells === grid.cells && cache.colour === look.colour) return cache.canvas;
    const { canvas } = cache;
    canvas.width = grid.columns;
    canvas.height = grid.rows;
    const context = canvas.getContext('2d');
    if (!context || !look.rgb) return null;
    const image = context.createImageData(grid.columns, grid.rows);
    const [red, green, blue] = look.rgb;
    const data = image.data;
    const cells = grid.cells;
    for (let i = 0; i < grid.columns * grid.rows; i++) {
      const value = cells[i];
      if (value === 0) continue;
      const o = i * 4;
      data[o] = red * 255;
      data[o + 1] = green * 255;
      data[o + 2] = blue * 255;
      data[o + 3] = value * GRID_ALPHA;
    }
    context.putImageData(image, 0, 0);
    cache.cells = grid.cells;
    cache.colour = look.colour;
    return canvas;
  }

  private drawLines(
    context: CanvasRenderingContext2D,
    view: BevView,
    frame: NeatBevFrame,
    colours: LabelColours,
  ): void {
    const lines = frame.lines;
    if (!lines) return;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    for (const line of lines) {
      const xy = line.xy;
      if (xy.length < 4) continue;
      const look = colours.of(line.label);
      context.strokeStyle = look.colour;
      context.lineWidth = look.width;
      context.setLineDash(dashOf(look.style ?? line.style));
      context.beginPath();
      for (let i = 0; i + 1 < xy.length; i += 2) {
        const at = toScreen(view, xy[i], xy[i + 1], this.point);
        if (i === 0) context.moveTo(at.x, at.y);
        else context.lineTo(at.x, at.y);
      }
      if (line.closed) context.closePath();
      context.stroke();
    }
    context.setLineDash(SOLID);
  }

  private drawPoints(
    context: CanvasRenderingContext2D,
    view: BevView,
    frame: NeatBevFrame,
    colours: LabelColours,
    shape: NeatBevShape,
  ): void {
    const sets = frame.points;
    if (!sets?.some((set) => set.xy.length >= 2)) return;
    // The buffer covers the plot alone (for a round plot, the square around its circle), in
    // device pixels, so a wide box clears and uploads no more than it shows points in.
    const ratio = this.ratio;
    const area = plotArea(this.width, this.height, shape);
    const left = Math.max(0, Math.floor((area.cx - area.halfWidth) * ratio));
    const top = Math.max(0, Math.floor((area.cy - area.halfHeight) * ratio));
    const right = Math.min(this.canvas.width, Math.ceil((area.cx + area.halfWidth) * ratio));
    const bottom = Math.min(this.canvas.height, Math.ceil((area.cy + area.halfHeight) * ratio));
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
