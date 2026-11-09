import type { NeatBevObject, NeatBevShape, NeatBevSpoke } from './model';

/*
 * The bird's-eye view's geometry, without the DOM: where the plot sits in the component's box, how
 * metres around the vehicle map to CSS pixels and back, the rings' step, the spokes' ends, the
 * objects' corners and what lies under the pointer. Metres are the vehicle's frame (x forward,
 * y left); the screen has forward up and left to the left.
 */

/** CSS px between the box's edge and the range at the default zoom: room for the outer ring. */
export const PLOT_INSET = 12;
/** How far the view zooms in: a quarter of the range across the plot. */
export const ZOOM_MAX = 4;
/** The direction the rings' labels sit in from the vehicle: halfway between forward and left. */
export const LABEL_ANGLE = Math.PI / 4;

/** The plot within the box (CSS px): its centre and half its width and height. */
export interface PlotArea {
  readonly cx: number;
  readonly cy: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
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
 * Where the plot sits in a `width` × `height` box: round, the largest square that fits, centred;
 * square, the whole box.
 */
export function plotArea(width: number, height: number, shape: NeatBevShape): PlotArea {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (shape === 'square') return { cx: w / 2, cy: h / 2, halfWidth: w / 2, halfHeight: h / 2 };
  const half = Math.min(w, h) / 2;
  return { cx: w / 2, cy: h / 2, halfWidth: half, halfHeight: half };
}

/** The default view of `area`: `range` metres from the vehicle to the plot's nearer edge. */
export function defaultView(area: PlotArea, range: number): BevView {
  const reach = Math.min(area.halfWidth, area.halfHeight) - PLOT_INSET;
  const ppm = reach > 0 && range > 0 ? reach / range : 0;
  return { cx: area.cx, cy: area.cy, ppm, k: 1, tx: 0, ty: 0 };
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
 * How far (metres) a spoke from `origin` at `angle` runs before it leaves the plot: the circle of
 * `range` around the vehicle (round) or the square of ±`range` (square). 0 when it starts outside.
 */
export function spokeLength(
  origin: { readonly x: number; readonly y: number },
  angle: number,
  shape: NeatBevShape,
  range: number,
): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  if (shape === 'round') {
    // |origin + t·d| = range, the larger root.
    const along = origin.x * dx + origin.y * dy;
    const inside = range * range - (origin.x * origin.x + origin.y * origin.y);
    if (inside <= 0) return 0;
    return -along + Math.sqrt(along * along + inside);
  }
  if (Math.abs(origin.x) >= range || Math.abs(origin.y) >= range) return 0;
  let t = Infinity;
  if (Math.abs(dx) > 1e-12) t = Math.min(t, ((dx > 0 ? range : -range) - origin.x) / dx);
  if (Math.abs(dy) > 1e-12) t = Math.min(t, ((dy > 0 ? range : -range) - origin.y) / dy);
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
