import type { NeatDiagramSide } from './model';

/*
 * The rounded edge shape: an edge runs in straight, axis-parallel segments from port to port, and
 * each turn is one cubic bezier whose two control points sit on the corner of an isosceles
 * right-angled L (both legs `bend` long, so the curve leaves and joins its runs tangentially).
 * Pure: the layout and the tests call it with port points and sides.
 */

export interface Point {
  x: number;
  y: number;
}

/** How long a turn's legs are at most (diagram units); a shorter run makes them shorter. */
const BEND = 60;
/** How far an edge goes straight out of a port before turning (when its target lies behind). */
const STUB = 30;

/** The way out of a node through its side. */
const OUT: Record<NeatDiagramSide, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const length = (a: Point) => Math.hypot(a.x, a.y);

/**
 * The corners of the edge from `source` (leaving through `sourceSide`) to `target` (entering
 * through `targetSide`), ends included. One turn when the sides are at right angles (an L), two
 * when they face each other (a Z, its middle run `jog` further along the way than halfway; 0
 * when the ports are level, a straight line), and stubs out of both ports when the target lies
 * behind the source. Edges that share a loop are drawn as parallel offsets of one another (the
 * layout's `spreadLoops`): a U goes `jog` further out than `STUB`, and a route behind its source
 * takes `stubs` more at each end and moves its run across `jog` (in the level's coordinates).
 */
export function routePoints(
  source: Point,
  sourceSide: NeatDiagramSide,
  target: Point,
  targetSide: NeatDiagramSide,
  jog = 0,
  stubs: readonly [number, number] = [0, 0],
): Point[] {
  const out = OUT[sourceSide];
  const back = OUT[targetSide];
  const horizontal = out.x !== 0;
  const ahead = (corner: Point) =>
    dot(sub(corner, source), out) > 0 && dot(sub(corner, target), back) > 0;
  if (dot(out, back) === 0) {
    const corner = horizontal ? { x: target.x, y: source.y } : { x: source.x, y: target.y };
    if (ahead(corner)) return [source, corner, target];
  } else if (dot(out, back) < 0 && dot(sub(target, source), out) > 0) {
    // Facing each other with the target ahead: straight when level, else a Z.
    if (horizontal ? source.y === target.y : source.x === target.x) return [source, target];
    if (horizontal) {
      const x = (source.x + target.x) / 2 + jog * out.x;
      return [source, { x, y: source.y }, { x, y: target.y }, target];
    }
    const y = (source.y + target.y) / 2 + jog * out.y;
    return [source, { x: source.x, y }, { x: target.x, y }, target];
  } else if (dot(out, back) > 0) {
    // Both ports face the same way: out past the farther one and back (a U).
    const reach = STUB + jog;
    if (horizontal) {
      const x =
        out.x > 0 ? Math.max(source.x, target.x) + reach : Math.min(source.x, target.x) - reach;
      return [source, { x, y: source.y }, { x, y: target.y }, target];
    }
    const y =
      out.y > 0 ? Math.max(source.y, target.y) + reach : Math.min(source.y, target.y) - reach;
    return [source, { x: source.x, y }, { x: target.x, y }, target];
  }
  // Otherwise the target lies behind: a stub out of each port, joined by one corner (sides at
  // right angles) or by a run across halfway between the ports (sides facing each other).
  const outStub = STUB + stubs[0];
  const backStub = STUB + stubs[1];
  const a = { x: source.x + out.x * outStub, y: source.y + out.y * outStub };
  const b = { x: target.x + back.x * backStub, y: target.y + back.y * backStub };
  if (dot(out, back) === 0) {
    const corner = horizontal ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
    return simplify([source, a, corner, b, target]);
  }
  const across = horizontal
    ? [
        { x: a.x, y: (a.y + b.y) / 2 + jog },
        { x: b.x, y: (a.y + b.y) / 2 + jog },
      ]
    : [
        { x: (a.x + b.x) / 2 + jog, y: a.y },
        { x: (a.x + b.x) / 2 + jog, y: b.y },
      ];
  return simplify([source, a, ...across, b, target]);
}

/** Without repeated points and without corners that do not turn (three in a line). */
function simplify(points: Point[]): Point[] {
  const kept: Point[] = [];
  for (const p of points) {
    const last = kept[kept.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    const before = kept[kept.length - 2];
    if (before && last) {
      const d1 = sub(last, before);
      const d2 = sub(p, last);
      // Straight on: the middle point goes. A U-turn keeps it.
      if (d1.x * d2.y - d1.y * d2.x === 0 && dot(d1, d2) > 0) kept.pop();
    }
    kept.push(p);
  }
  return kept;
}

/** A piece of a drawn edge: a straight run to `line`, or a turn (cubic bezier) to `curve[2]`. */
export type Piece = { line: Point } | { curve: [Point, Point, Point] };

const same = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
const endOf = (p: Piece): Point => ('line' in p ? p.line : p.curve[2]);

/**
 * The corners rounded: each turn's legs are `bend` long, at most the shorter of its two runs
 * (half of a run between two turns, so neighbouring turns never overlap).
 */
export function roundCorners(points: Point[], bend = BEND): Piece[] {
  const pieces: Piece[] = [];
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const corner = points[i];
    const inRun = sub(corner, points[i - 1]);
    const outRun = sub(points[i + 1], corner);
    const inLength = length(inRun) / (i - 1 > 0 ? 2 : 1);
    const outLength = length(outRun) / (i + 1 < last ? 2 : 1);
    const leg = Math.min(bend, inLength, outLength);
    const into = length(inRun);
    const away = length(outRun);
    const start = { x: corner.x - (inRun.x / into) * leg, y: corner.y - (inRun.y / into) * leg };
    const end = { x: corner.x + (outRun.x / away) * leg, y: corner.y + (outRun.y / away) * leg };
    pieces.push({ line: start }, { curve: [corner, corner, end] });
  }
  pieces.push({ line: points[last] });
  // A run used up by its turns leaves no straight piece (no zero-length lines).
  return pieces.filter(
    (p, i) => !('line' in p) || !same(p.line, i === 0 ? points[0] : endOf(pieces[i - 1])),
  );
}

const n = (v: number) => Math.round(v * 100) / 100;

/** The SVG path through a route's corners (`routePoints`), drawn in the rounded shape. */
export function pathThrough(points: Point[]): string {
  const [start] = points;
  let d = `M ${n(start.x)} ${n(start.y)}`;
  for (const piece of roundCorners(points)) {
    if ('line' in piece) d += ` L ${n(piece.line.x)} ${n(piece.line.y)}`;
    else d += ` C ${piece.curve.map((p) => `${n(p.x)} ${n(p.y)}`).join(' ')}`;
  }
  return d;
}

/** Points along the pieces from `start` (each turn in `steps` parts): the drawn shape, sampled. */
export function sampleRoute(start: Point, pieces: Piece[], steps = 12): Point[] {
  const points = [start];
  let at = start;
  for (const piece of pieces) {
    if ('line' in piece) {
      points.push(piece.line);
      at = piece.line;
      continue;
    }
    const [c1, c2, to] = piece.curve;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      points.push({
        x: w[0] * at.x + w[1] * c1.x + w[2] * c2.x + w[3] * to.x,
        y: w[0] * at.y + w[1] * c1.y + w[2] * c2.y + w[3] * to.y,
      });
    }
    at = to;
  }
  return points;
}

/**
 * The point `t` of the way along the drawn shape of the route through `points` (its corners, as
 * `routePoints` gives them), by length: 0 at its start, 1 at its end, clamped. Measured on the
 * rounded shape rather than on the corners, so an edge label or a note's anchor near a turn sits
 * on the line that is drawn.
 */
export function pointAlong(points: Point[], t: number): Point {
  const drawn = sampleRoute(points[0], roundCorners(points));
  const runs = drawn.slice(1).map((p, i) => length(sub(p, drawn[i])));
  let left = Math.min(Math.max(t, 0), 1) * runs.reduce((sum, run) => sum + run, 0);
  for (let i = 0; i < runs.length; i++) {
    if (left <= runs[i] && runs[i] > 0) {
      const f = left / runs[i];
      const a = drawn[i];
      const b = drawn[i + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    left -= runs[i];
  }
  return drawn[drawn.length - 1];
}
