import type {
  NeatBevBounds,
  NeatBevObject,
  NeatBevOverflow,
  NeatBevShape,
  NeatBevSpoke,
} from './model';

/*
 * The bird's-eye view's geometry, without the DOM: the plot in metres (a circle or a rectangle),
 * how it fits the component's box, how metres around the vehicle map to CSS pixels and back, the
 * rings' step, the spokes' ends, the objects' corners and what lies under the pointer. Metres are
 * the vehicle's frame (x forward, y left); the screen has forward up and left to the left.
 */

/** CSS px between the box's edge and the plot at the default zoom: room for the outline. */
export const PLOT_INSET = 12;
/** How far the view zooms in: a quarter of the range across the plot. */
export const ZOOM_MAX = 4;
/** The direction the rings' labels sit in from the vehicle: halfway between forward and left. */
export const LABEL_ANGLE = Math.PI / 4;

/**
 * The plot in metres: its shape, the circle's radius (`range`), and the rectangle it fills (the
 * circle's square of ±`range`, or the rect's bounds) by its back, front, right and left edges.
 */
export interface BevPlot {
  readonly shape: NeatBevShape;
  readonly range: number;
  readonly back: number;
  readonly front: number;
  readonly right: number;
  readonly left: number;
}

/** The plot of `shape`: the circle of `range`, or the rectangle `bounds` (±`range` without). */
export function bevPlot(
  shape: NeatBevShape,
  range: number,
  bounds: NeatBevBounds | null = null,
): BevPlot {
  if (shape === 'rect' && bounds) {
    const [back, front] = bounds.x;
    const [right, left] = bounds.y;
    return { shape, range, back, front, right, left };
  }
  return { shape, range, back: -range, front: range, right: -range, left: range };
}

/** Whether the plot has room to draw in: a positive range, a rectangle with each min below max. */
export function hasArea(plot: BevPlot): boolean {
  const { back, front, right, left } = plot;
  if (plot.shape === 'round' && !(plot.range > 0 && Number.isFinite(plot.range))) return false;
  return (
    Number.isFinite(front - back) && Number.isFinite(left - right) && front > back && left > right
  );
}

/** The plot's width over its height on the screen: 1 for the circle, the rectangle's otherwise. */
export function plotAspect(plot: BevPlot): number {
  return hasArea(plot) ? (plot.left - plot.right) / (plot.front - plot.back) : 1;
}

/** Metres from the plot's middle to its nearer edge: what the rings' or grid's step is made from. */
export function plotReach(plot: BevPlot): number {
  return Math.min(plot.left - plot.right, plot.front - plot.back) / 2;
}

/** Whether the point `x`, `y` (metres) lies on the plot: within the circle, or the rectangle. */
export function onPlot(plot: BevPlot, x: number, y: number): boolean {
  if (plot.shape === 'round') return Math.hypot(x, y) <= plot.range;
  return x >= plot.back && x <= plot.front && y >= plot.right && y <= plot.left;
}

/**
 * How metres map to the screen: the plot's centre (`cx`, `cy`), pixels per metre at the default
 * zoom (`ppm`), and the pan and zoom on top (`k`, `tx`, `ty`, a d3-zoom transform of the default
 * view's pixels).
 */
export interface BevView {
  readonly cx: number;
  readonly cy: number;
  readonly ppm: number;
  readonly k: number;
  readonly tx: number;
  readonly ty: number;
}

/**
 * The default view of `plot` in a `width` × `height` box: the plot's rectangle as large as fits
 * within `PLOT_INSET` of the box's edges, its middle at the box's middle (so the vehicle is off
 * the middle when the rectangle is). No scale (`ppm` 0) when there is no room or no plot.
 */
export function defaultView(width: number, height: number, plot: BevPlot): BevView {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  let ppm = 0;
  if (hasArea(plot)) {
    const fit = Math.min(
      (w - 2 * PLOT_INSET) / (plot.left - plot.right),
      (h - 2 * PLOT_INSET) / (plot.front - plot.back),
    );
    if (fit > 0) ppm = fit;
  }
  return {
    cx: w / 2 + ((plot.left + plot.right) / 2) * ppm,
    cy: h / 2 + ((plot.front + plot.back) / 2) * ppm,
    ppm,
    k: 1,
    tx: 0,
    ty: 0,
  };
}

/** A rectangle on the screen, CSS px: its top left and bottom right corners. */
export type ScreenRect = readonly [readonly [number, number], readonly [number, number]];

/**
 * Where the view may pan, in the default view's pixels: what the default view shows, the plot's
 * rectangle with `'clip'` or the whole `width` × `height` box with `'visible'`.
 */
export function panBounds(
  view: BevView,
  plot: BevPlot,
  overflow: NeatBevOverflow,
  width: number,
  height: number,
): ScreenRect {
  if (overflow === 'visible') {
    return [
      [0, 0],
      [width, height],
    ];
  }
  return [
    [view.cx - plot.left * view.ppm, view.cy - plot.front * view.ppm],
    [view.cx - plot.right * view.ppm, view.cy - plot.back * view.ppm],
  ];
}

/** The plot's rectangle on the screen in `view`, zoom included. */
export function plotRect(view: BevView, plot: BevPlot): ScreenRect {
  const scale = view.ppm * view.k;
  const x = view.tx + view.k * view.cx;
  const y = view.ty + view.k * view.cy;
  return [
    [x - plot.left * scale, y - plot.front * scale],
    [x - plot.right * scale, y - plot.back * scale],
  ];
}

/** The `width` × `height` box in `view` as a rectangle in metres (a rect plot). */
export function boxPlot(view: BevView, width: number, height: number, range: number): BevPlot {
  const scale = view.ppm * view.k;
  const x = view.tx + view.k * view.cx;
  const y = view.ty + view.k * view.cy;
  return {
    shape: 'rect',
    range,
    back: (y - height) / scale,
    front: y / scale,
    right: (x - width) / scale,
    left: x / scale,
  };
}

/** The distance (metres) from the vehicle to the farthest corner of a rect plot. */
export function farthestCorner(plot: BevPlot): number {
  return Math.hypot(
    Math.max(Math.abs(plot.back), Math.abs(plot.front)),
    Math.max(Math.abs(plot.right), Math.abs(plot.left)),
  );
}

/**
 * The direction (radians from forward) the rings' labels sit in: `LABEL_ANGLE` while the vehicle
 * is in the `width` × `height` box, else towards the box's middle, so they stay on the screen.
 */
export function labelAngle(view: BevView, width: number, height: number): number {
  const scale = view.ppm * view.k;
  const x = view.tx + view.k * view.cx;
  const y = view.ty + view.k * view.cy;
  if (x >= 0 && x <= width && y >= 0 && y <= height) return LABEL_ANGLE;
  return Math.atan2((x - width / 2) / scale, (y - height / 2) / scale);
}

/** A point, written into by the mappings below so that a frame allocates none. */
export interface MutablePoint {
  x: number;
  y: number;
}

/** The screen point (CSS px) of `x` metres forward and `y` metres left, into `into`. */
export function toScreen(view: BevView, x: number, y: number, into: MutablePoint): MutablePoint {
  into.x = view.tx + view.k * (view.cx - y * view.ppm);
  into.y = view.ty + view.k * (view.cy - x * view.ppm);
  return into;
}

/** The vehicle's point (metres, x forward and y left) at the screen point `sx`, `sy`, into `into`. */
export function toVehicle(view: BevView, sx: number, sy: number, into: MutablePoint): MutablePoint {
  into.x = (view.cy - (sy - view.ty) / view.k) / view.ppm;
  into.y = (view.cx - (sx - view.tx) / view.k) / view.ppm;
  return into;
}

/** Pixels per metre on the screen, the zoom included. */
export function pixelsPerMetre(view: BevView): number {
  return view.ppm * view.k;
}

/**
 * The canvas angle (clockwise from the screen's +x, as `arc` takes it) of the vehicle's angle `a`
 * (counter-clockwise from forward).
 */
export function canvasAngle(a: number): number {
  return -Math.PI / 2 - a;
}

/**
 * The rings' step for a view `range` metres across: 1, 2 or 5 times a power of ten, the one
 * nearest (on a log scale) to a sixth of the range, so about six rings show (10 m at 60 m).
 */
export function ringStep(range: number): number {
  if (!(range > 0) || !Number.isFinite(range)) return 1;
  const target = range / 6;
  const power = 10 ** Math.floor(Math.log10(target));
  let best = power;
  for (const factor of [1, 2, 5, 10]) {
    const step = factor * power;
    if (Math.abs(Math.log(step / target)) < Math.abs(Math.log(best / target))) best = step;
  }
  return best;
}

/** The least distance between rings or grid lines on the screen, CSS px: room for a label. */
export const MIN_STEP_PX = 44;

/**
 * The step between rings or grid lines in `view`: about six across the shown range (`range` at
 * zoom `k`), and coarser while they would sit closer than `MIN_STEP_PX` on the screen.
 */
export function stepFor(range: number, view: BevView): number {
  let step = ringStep(range / view.k);
  const scale = view.ppm * view.k;
  if (!(scale > 0)) return step;
  while (step * scale < MIN_STEP_PX) step = nextNice(step);
  return step;
}

/** The next of 1, 2 and 5 times a power of ten above `step`. */
function nextNice(step: number): number {
  const power = 10 ** Math.floor(Math.log10(step) + 1e-9);
  const factor = Math.round(step / power);
  return (factor < 2 ? 2 : factor < 5 ? 5 : 10) * power;
}

/** A distance in metres as the plot labels it: at most one decimal ("10 m", "2.5 m"). */
export function metresText(value: number): string {
  return `${Number(value.toFixed(1))} m`;
}

const CENTRE = { x: 0, y: 0 } as const;

/**
 * The spokes to draw: a number spaces that many evenly from straight ahead (0, or anything not a
 * positive number, draws none; a fraction rounds down); a list is drawn as given, an `origin` it
 * leaves out being the vehicle's centre.
 */
export function spokeList(
  spokes: number | readonly NeatBevSpoke[],
): readonly Required<NeatBevSpoke>[] {
  if (typeof spokes === 'number') {
    const count = Number.isFinite(spokes) && spokes > 0 ? Math.floor(spokes) : 0;
    return Array.from({ length: count }, (_, i) => ({
      angle: (2 * Math.PI * i) / count,
      origin: CENTRE,
    }));
  }
  return spokes
    .filter((spoke) => Number.isFinite(spoke.angle))
    .map((spoke) => ({ angle: spoke.angle, origin: spoke.origin ?? CENTRE }));
}

/**
 * How far (metres) a spoke from `origin` at `angle` runs before it leaves `plot`: the circle of its
 * range around the vehicle, or its rectangle. 0 when it starts outside.
 */
export function spokeLength(
  origin: { readonly x: number; readonly y: number },
  angle: number,
  plot: BevPlot,
): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  if (plot.shape === 'round') {
    // |origin + t·d| = range, the larger root.
    const range = plot.range;
    const along = origin.x * dx + origin.y * dy;
    const inside = range * range - (origin.x * origin.x + origin.y * origin.y);
    if (inside <= 0) return 0;
    return -along + Math.sqrt(along * along + inside);
  }
  const { back, front, right, left } = plot;
  if (origin.x <= back || origin.x >= front || origin.y <= right || origin.y >= left) return 0;
  let t = Infinity;
  if (Math.abs(dx) > 1e-12) t = Math.min(t, ((dx > 0 ? front : back) - origin.x) / dx);
  if (Math.abs(dy) > 1e-12) t = Math.min(t, ((dy > 0 ? left : right) - origin.y) / dy);
  return Number.isFinite(t) ? t : 0;
}

/**
 * The four corners of `object` (metres) into `into` as x, y pairs: front left, front right, back
 * right, back left. Returns `into`, so a frame reuses one array for every object.
 */
export function objectCorners(object: NeatBevObject, into: Float64Array): Float64Array {
  const cos = Math.cos(object.yaw);
  const sin = Math.sin(object.yaw);
  const l = object.length / 2;
  const w = object.width / 2;
  const along = [l, l, -l, -l];
  const across = [w, -w, -w, w];
  for (let i = 0; i < 4; i++) {
    into[2 * i] = object.x + along[i] * cos - across[i] * sin;
    into[2 * i + 1] = object.y + along[i] * sin + across[i] * cos;
  }
  return into;
}

/**
 * The index of the object under the point (`x`, `y` metres), allowing `tolerance` metres around
 * each, the one drawn last (on top) winning; -1 for none.
 */
export function hitObject(
  objects: readonly NeatBevObject[],
  x: number,
  y: number,
  tolerance: number,
): number {
  for (let i = objects.length - 1; i >= 0; i--) {
    const object = objects[i];
    const dx = x - object.x;
    const dy = y - object.y;
    const cos = Math.cos(object.yaw);
    const sin = Math.sin(object.yaw);
    const along = dx * cos + dy * sin;
    const across = -dx * sin + dy * cos;
    if (
      Math.abs(along) <= object.length / 2 + tolerance &&
      Math.abs(across) <= object.width / 2 + tolerance
    ) {
      return i;
    }
  }
  return -1;
}
