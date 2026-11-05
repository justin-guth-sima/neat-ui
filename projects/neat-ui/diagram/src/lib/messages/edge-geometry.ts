import { type Point, roundCorners, sampleRoute } from '../route';

/*
 * An edge's drawn shape, sampled once, for the dots that move along it every frame. `pointAlong`
 * samples the rounded route and measures it on every call, which is right for a label placed once
 * per layout and wrong for thousands of dots per frame; this keeps the samples and their
 * cumulative lengths, and finds a point by a binary search that allocates nothing.
 */

export class EdgeGeometry {
  private constructor(
    /** The drawn shape's length, in diagram units. */
    readonly length: number,
    /** The cumulative length at each sample, from 0 at the first to `length` at the last. */
    readonly lut: Float32Array,
    /** The samples as x, y pairs, in the level's coordinates. */
    readonly xy: Float32Array,
  ) {}

  /**
   * The drawn shape of the route through `points` (its corners, as `routePoints` gives them), the
   * same samples `pointAlong` measures, so a dot runs on the line that is drawn.
   */
  static fromPoints(points: readonly Point[]): EdgeGeometry {
    const drawn = points.length > 1 ? sampleRoute(points[0], roundCorners([...points])) : points;
    const lut = new Float32Array(drawn.length);
    const xy = new Float32Array(2 * drawn.length);
    let length = 0;
    drawn.forEach((p, i) => {
      if (i > 0) length += Math.hypot(p.x - drawn[i - 1].x, p.y - drawn[i - 1].y);
      lut[i] = length;
      xy[2 * i] = p.x;
      xy[2 * i + 1] = p.y;
    });
    return new EdgeGeometry(length, lut, xy);
  }

  /**
   * The point `t` of the way along the shape by length (0 at its start, 1 at its end, clamped),
   * written into `into` and returned, so a caller moving dots every frame allocates nothing.
   * `xy` is the same samples in other coordinates (the layer's, mapped to the screen once per pan
   * or zoom): a transform that scales both axes alike keeps the shares of the length, so the table
   * measured in diagram units finds the point there too. `before` and `after` (diagram units) run
   * the way on past the ends, straight on along the first and the last sample's direction: 0 is
   * then that far before the start and 1 that far past the end, so a dot can leave from inside the
   * card it comes out of and go on until it is wholly inside the card it enters.
   */
  at(t: number, into: Point, xy: Float32Array = this.xy, before = 0, after = 0): Point {
    const { lut } = this;
    const last = lut.length - 1;
    const target = (t > 0 ? Math.min(t, 1) : 0) * (this.length + before + after) - before;
    if (last >= 1 && target < 0) return beyond(lut, xy, 0, 1, -target, into);
    if (last >= 1 && target > this.length) {
      return beyond(lut, xy, last, last - 1, target - this.length, into);
    }
    if (last < 1 || target <= 0) {
      into.x = xy[0];
      into.y = xy[1];
      return into;
    }
    // The first sample at or past the target: the point lies between it and the one before.
    let lo = 1;
    let hi = last;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lut[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const run = lut[lo] - lut[lo - 1];
    // At most 1: the table's float32 lengths can fall a hair short of `length` at the end.
    const f = run > 0 ? Math.min(1, (target - lut[lo - 1]) / run) : 1;
    into.x = xy[2 * lo - 2] + (xy[2 * lo] - xy[2 * lo - 2]) * f;
    into.y = xy[2 * lo - 1] + (xy[2 * lo + 1] - xy[2 * lo - 1]) * f;
    return into;
  }
}

/** The point `distance` (diagram units) past sample `end`, straight on from sample `inner`. */
function beyond(
  lut: Float32Array,
  xy: Float32Array,
  end: number,
  inner: number,
  distance: number,
  into: Point,
): Point {
  const run = Math.abs(lut[end] - lut[inner]);
  const f = run > 0 ? distance / run : 0;
  into.x = xy[2 * end] + (xy[2 * end] - xy[2 * inner]) * f;
  into.y = xy[2 * end + 1] + (xy[2 * end + 1] - xy[2 * inner + 1]) * f;
  return into;
}
