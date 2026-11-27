/*
 * The gauge's geometry, in the units of its drawing's viewBox: a ¾ circle (270°) from the bottom
 * left clockwise to the bottom right, angles in degrees clockwise from straight up. A place along
 * the arc is a share of its sweep, 0 at the start (min) and 1 at the end (max). Internal.
 */

/** The drawing's box: the track with its caps and a margin at the sides, down to the arc's ends. */
export const GAUGE_VIEW = { width: 200, height: 162 } as const;
/** The arc's center. */
export const GAUGE_CENTER = { x: 100, y: 95 } as const;
/** The radius of the gauge track and the value arc (the middle of their stroke). */
export const ARC_RADIUS = 80;

/** Where the sweep starts, bottom left. */
const START_ANGLE = 225;
/** How far it turns, clockwise. */
const SWEEP = 270;

const clampShare = (share: number): number => Math.min(1, Math.max(0, share));
/** Two places after the point: enough for the drawing, and a short `d`. */
const unit = (n: number): number => +n.toFixed(2);

/** Whether `min` and `max` make a range a gauge can draw: finite numbers, `min` below `max`. */
export function validRange(min: number, max: number): boolean {
  return Number.isFinite(min) && Number.isFinite(max) && min < max;
}

/**
 * Where `value` sits along the sweep, held to the range (0 at `min` and below, 1 at `max` and
 * above), or null when there is no arc to draw: no value, a value that is no finite number, or a
 * range that is none.
 */
export function gaugeShare(
  value: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (!validRange(min, max)) return null;
  return clampShare((value - min) / (max - min));
}

/** The point `share` along the sweep on the circle of `radius` around the center. */
export function pointAt(share: number, radius: number): { x: number; y: number } {
  const angle = ((START_ANGLE + SWEEP * share) * Math.PI) / 180;
  return {
    x: GAUGE_CENTER.x + radius * Math.sin(angle),
    y: GAUGE_CENTER.y - radius * Math.cos(angle),
  };
}

/**
 * The arc from `from` to `to` (shares of the sweep, held to it) on the circle of `radius`, as one
 * clockwise SVG arc; empty when it has no length, so a round cap draws no dot at the start.
 */
export function arcPath(from: number, to: number, radius: number): string {
  const [start, end] = [clampShare(from), clampShare(to)];
  if (end <= start) return '';
  const a = pointAt(start, radius);
  const b = pointAt(end, radius);
  const large = (end - start) * SWEEP > 180 ? 1 : 0;
  return `M ${unit(a.x)} ${unit(a.y)} A ${radius} ${radius} 0 ${large} 1 ${unit(b.x)} ${unit(b.y)}`;
}
