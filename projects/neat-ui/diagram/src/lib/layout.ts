import type { NeatDiagram, NeatDiagramEdge, NeatDiagramNode, NeatDiagramSide } from './model';
import { firstOfEachId, reportLeftOut } from './report';
import { pathThrough, type Point, routePoints } from './route';

/*
 * A level laid out for drawing: where each node is in the level's coordinates, where each edge
 * leaves and enters its nodes, and how it runs between them. Pure, so the layout is tested
 * without a browser; the renderer draws what it returns.
 */

export interface Rect extends Point {
  w: number;
  h: number;
}

/** An edge as drawn: its ports and their sides, and its route in the rounded shape. */
export interface EdgeLayout {
  /**
   * Its port on `from`, in the level's coordinates, and the side of `from` it leaves through. An
   * edge between a frame and a node inside it has its frame end on the border nearest the node and
   * runs inward: that end's side is the way it runs (`top` for a port on the bottom border).
   */
  source: Point;
  sourceSide: NeatDiagramSide;
  /** Its port on `to` and the side of `to` it enters through (for a frame, as above). */
  target: Point;
  targetSide: NeatDiagramSide;
  /** The SVG path of its rounded shape. */
  path: string;
  /** Its route's corners, ends included, along which `pointAlong` measures. */
  points: Point[];
}

/**
 * Each node's rectangle in the level's coordinates: its position plus those of the nodes it sits
 * in, however deep. A node whose parent is not on the level, or that lies inside itself, is left
 * out with what sits in it, so the rest of a broken diagram still draws; so is a node whose id an
 * earlier node already has.
 */
export function absoluteRects(diagram: NeatDiagram): Map<string, Rect> {
  const nodes = firstOfEachId(diagram.nodes, 'node');
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Each node's top-left corner, null when it cannot be placed.
  const corners = new Map<string, Point | null>();
  // `chain`: the node and those below it whose corners wait for this one, to catch a loop.
  const corner = (node: NeatDiagramNode, chain: ReadonlySet<string>): Point | null => {
    const known = corners.get(node.id);
    if (known !== undefined) return known;
    const parent = node.parent === undefined ? undefined : byId.get(node.parent);
    let at: Point | null = null;
    if (node.parent === undefined) {
      at = { x: node.x, y: node.y };
    } else if (!parent) {
      reportLeftOut(
        `node "${node.id}" is left out: its parent "${node.parent}" is not on its level`,
      );
    } else if (chain.has(parent.id)) {
      reportLeftOut(`node "${node.id}" is left out: its parent "${parent.id}" lies inside it`);
    } else {
      const origin = corner(parent, new Set(chain).add(parent.id));
      at = origin && { x: origin.x + node.x, y: origin.y + node.y };
    }
    corners.set(node.id, at);
    return at;
  };
  const rects = new Map<string, Rect>();
  for (const node of nodes) {
    const at = corner(node, new Set([node.id]));
    if (at) rects.set(node.id, { ...at, w: node.w, h: node.h });
  }
  return rects;
}

/** An edge end while the ports are placed. */
interface End {
  node: string;
  side: NeatDiagramSide;
  /** From the side's middle, down or right. */
  offset: number;
  /** The edge's direction, from its source's centre to its target's. */
  along: Point;
  /** 1 at the edge's source, -1 at its target. */
  sign: 1 | -1;
  /** The edge's place in the level's list. */
  order: number;
}

/**
 * An edge's ends for the rounded shape, and how much further than halfway its middle run lies
 * when it is a Z (`jog`).
 */
interface Route {
  edge: NeatDiagramEdge;
  source: Point;
  sourceSide: NeatDiagramSide;
  target: Point;
  targetSide: NeatDiagramSide;
  jog: number;
}

/**
 * Per side: `t`, the way its ports are spread (offset grows along it), `n`, the way out of the
 * node.
 */
export const SIDE_AXES: Record<NeatDiagramSide, { t: Point; n: Point }> = {
  left: { t: { x: 0, y: 1 }, n: { x: -1, y: 0 } },
  right: { t: { x: 0, y: 1 }, n: { x: 1, y: 0 } },
  top: { t: { x: 1, y: 0 }, n: { x: 0, y: -1 } },
  bottom: { t: { x: 1, y: 0 }, n: { x: 0, y: 1 } },
};

const OPPOSITE: Record<NeatDiagramSide, NeatDiagramSide> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const horizontal = (side: NeatDiagramSide) => side === 'left' || side === 'right';

/** Most room between neighbouring ports on a side, and the share of the side they may take. */
const PORT_STEP = 10;
const PORT_SPAN = 0.8;

/**
 * How far apart the middle runs of neighbouring Z edges are at most; they keep to the middle half
 * of their corridor, clear of the nodes (and frame borders) on either side.
 */
const JOG_STEP = 24;

/**
 * How far from a box's corner a straightened edge meets it at least: the theme's `--radius`
 * (0.5 rem, 8 px at zoom 1), so a straight edge never enters a rounded corner. Boxes whose overlap
 * leaves no room past their corners keep their Z.
 */
const CORNER = 8;

/** The least room a straightened edge leaves between its port and the next on the same side. */
const PORT_GAP = PORT_STEP / 2;

/**
 * Each edge as drawn, by id: its ends on the sides that face each other (or that its nodes name),
 * spread along each side so a fan does not cross itself, and its rounded route, Z routes that
 * share a corridor spread apart. An edge with an end that is not a node on the level (or one left
 * out), or whose id an earlier edge already has, is left out.
 */
export function layoutEdges(diagram: NeatDiagram): Map<string, EdgeLayout> {
  const rects = absoluteRects(diagram);
  const nodes = new Map(firstOfEachId(diagram.nodes, 'node').map((node) => [node.id, node]));
  const edges = firstOfEachId(diagram.edges, 'edge').filter((edge) => {
    const missing = [edge.from, edge.to].filter((id) => !rects.has(id));
    for (const id of missing) {
      // A node that is on the level but could not be placed has been named already, with why.
      const why = nodes.has(id) ? 'is left out itself' : 'is not on its level';
      reportLeftOut(`edge "${edge.id}" is left out: its end "${id}" ${why}`);
    }
    return missing.length === 0;
  });
  const rectOf = (id: string) => rects.get(id) as Rect;
  const centre = (id: string): Point => {
    const r = rectOf(id);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  };

  /** True when `inner` sits in `outer`, however deep. */
  const holds = (outer: string, inner: string): boolean => {
    // Bounded by the node count: a parent loop has been left out of `rects`, but stays in `nodes`.
    let parent = nodes.get(inner)?.parent;
    for (let steps = 0; parent !== undefined && steps < nodes.size; steps++) {
      if (parent === outer) return true;
      parent = nodes.get(parent)?.parent;
    }
    return false;
  };

  // Each edge end goes on the side its edge names, else its node names for it, else on the side
  // that faces the other end; between a frame and a node inside it, on the frame's border nearest
  // the node and the node's side facing that border, so the edge runs inside the frame. A frame's
  // own `outSide` and `inSide` are for the nodes around it, so they do not move that end.
  const ends = edges.map((edge, order) => {
    const a = centre(edge.from);
    const b = centre(edge.to);
    const frame = holds(edge.from, edge.to)
      ? edge.from
      : holds(edge.to, edge.from)
        ? edge.to
        : null;
    const inward = frame === null ? null : frame === edge.from ? 'source' : 'target';
    const border =
      frame === null
        ? null
        : nearestBorder(rectOf(frame), rectOf(frame === edge.from ? edge.to : edge.from));
    const [out, into] = border === null ? facingSides(a, b) : [border, border];
    const along = { x: b.x - a.x, y: b.y - a.y };
    const source: End = {
      node: edge.from,
      side: inward === 'source' ? out : (edge.fromSide ?? nodes.get(edge.from)?.outSide ?? out),
      offset: 0,
      along,
      sign: 1,
      order,
    };
    const target: End = {
      node: edge.to,
      side: inward === 'target' ? into : (edge.toSide ?? nodes.get(edge.to)?.inSide ?? into),
      offset: 0,
      along,
      sign: -1,
      order,
    };
    return { edge, source, target, inward };
  });
  const sides = spreadPorts(
    ends.flatMap((e) => [e.source, e.target]),
    rects,
  );
  straightenFacing(
    ends.filter(
      ({ edge, inward }) =>
        inward === null &&
        nodes.get(edge.from)?.role !== 'frame' &&
        nodes.get(edge.to)?.role !== 'frame',
    ),
    sides,
    rects,
  );

  // A frame's port on its own border leads inward: the route takes the border's opposite side.
  const routes: Route[] = ends.map(({ edge, source, target, inward }) => ({
    edge,
    source: portPoint(rectOf(source.node), source),
    sourceSide: inward === 'source' ? OPPOSITE[source.side] : source.side,
    target: portPoint(rectOf(target.node), target),
    targetSide: inward === 'target' ? OPPOSITE[target.side] : target.side,
    jog: 0,
  }));
  spreadCorridors(routes);

  return new Map(
    routes.map(({ edge, source, sourceSide, target, targetSide, jog }) => {
      const points = routePoints(source, sourceSide, target, targetSide, jog);
      const path = pathThrough(points);
      return [edge.id, { source, sourceSide, target, targetSide, path, points }];
    }),
  );
}

/** The key of a node's side, for the ports on it. */
const sideKey = (end: End) => `${end.node}\u0000${end.side}`;

/**
 * Ports on one side are spread along it in the order of the directions their edges leave in, so
 * edges fanning out from a side do not cross; parallel edges between the same two nodes keep one
 * order seen from both ends (by the side of the edge each port lies on). `ends` are in the order
 * of their edges, which breaks the remaining ties. Returns each side's ends in their order along
 * it, by `sideKey`.
 */
function spreadPorts(ends: End[], rects: Map<string, Rect>): Map<string, End[]> {
  const sides = new Map<string, End[]>();
  for (const end of ends) {
    const key = sideKey(end);
    sides.set(key, [...(sides.get(key) ?? []), end]);
  }
  for (const onSide of sides.values()) {
    const { node, side } = onSide[0];
    const { t, n } = SIDE_AXES[side];
    // The way to the other end is the edge's direction, reversed at its target.
    const angle = (e: End) => Math.atan2(e.sign * dot(e.along, t), e.sign * dot(e.along, n));
    const tie = (e: End) => e.order * Math.sign(t.x * -e.along.y + t.y * e.along.x || 1);
    onSide.sort((p, q) => angle(p) - angle(q) || tie(p) - tie(q));
    const rect = rects.get(node) as Rect;
    const length = horizontal(side) ? rect.h : rect.w;
    const step =
      onSide.length > 1 ? Math.min(PORT_STEP, (length * PORT_SPAN) / (onSide.length - 1)) : 0;
    onSide.forEach((e, i) => (e.offset = (i - (onSide.length - 1) / 2) * step));
  }
  return sides;
}

/**
 * An edge whose ports face each other (left and right, or top and bottom) between nodes whose
 * spans across that way overlap runs straight: both ports move to one coordinate inside the
 * overlap, clear of both boxes' corners, instead of drawing a Z whose bends lie a few units apart.
 * The coordinate is the spread port's of the end whose side has several ports (the source's when
 * both have), so a fan keeps its order; else the target's centre, or the overlap's middle when the
 * centre lies outside it; held to the overlap either way. A port moves only while it stays
 * `PORT_GAP` from its neighbours on its side, so no side's order changes and no fan crosses
 * itself; an edge that cannot move both its ports keeps its route, as does one already straight.
 * `sides` are each side's ends in their order along it, as `spreadPorts` leaves them.
 */
function straightenFacing(
  pairs: readonly { source: End; target: End }[],
  sides: Map<string, End[]>,
  rects: Map<string, Rect>,
): void {
  /** Whether `end` may take `offset` and stay `PORT_GAP` from the ports beside it on its side. */
  const keepsOrder = (end: End, offset: number): boolean => {
    const onSide = sides.get(sideKey(end)) as End[];
    const i = onSide.indexOf(end);
    const before = onSide[i - 1];
    const after = onSide[i + 1];
    return (
      (before === undefined || offset - before.offset >= PORT_GAP) &&
      (after === undefined || after.offset - offset >= PORT_GAP)
    );
  };
  for (const { source, target } of pairs) {
    if (OPPOSITE[source.side] !== target.side) continue;
    const a = rects.get(source.node) as Rect;
    const b = rects.get(target.node) as Rect;
    const from = portPoint(a, source);
    const to = portPoint(b, target);
    // Facing each other with the target ahead: the target behind is routed with stubs.
    if (dot({ x: to.x - from.x, y: to.y - from.y }, SIDE_AXES[source.side].n) <= 0) continue;
    const [across, size] = horizontal(source.side) ? (['y', 'h'] as const) : (['x', 'w'] as const);
    if (from[across] === to[across]) continue;
    const low = Math.max(a[across], b[across]) + CORNER;
    const high = Math.min(a[across] + a[size], b[across] + b[size]) - CORNER;
    if (low > high) continue;
    const fanning = [source, target].find((end) => (sides.get(sideKey(end)) as End[]).length > 1);
    const centre = b[across] + b[size] / 2;
    const wanted =
      fanning === source
        ? from[across]
        : fanning === target
          ? to[across]
          : centre < low || centre > high
            ? (low + high) / 2
            : centre;
    const at = Math.min(high, Math.max(low, wanted));
    const sourceOffset = at - (a[across] + a[size] / 2);
    const targetOffset = at - (b[across] + b[size] / 2);
    if (!keepsOrder(source, sourceOffset) || !keepsOrder(target, targetOffset)) continue;
    source.offset = sourceOffset;
    target.offset = targetOffset;
  }
}

/**
 * The sides of `a` and `b` that face each other: left and right unless `b` lies mostly above or
 * below `a`.
 */
function facingSides(a: Point, b: Point): [NeatDiagramSide, NeatDiagramSide] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy) / 2) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

/** The border of `outer` nearest `inner`, which sits in it (the first of a tie, in this order). */
function nearestBorder(outer: Rect, inner: Rect): NeatDiagramSide {
  const room: [NeatDiagramSide, number][] = [
    ['bottom', outer.y + outer.h - (inner.y + inner.h)],
    ['left', inner.x - outer.x],
    ['right', outer.x + outer.w - (inner.x + inner.w)],
    ['top', inner.y - outer.y],
  ];
  return room.reduce((best, side) => (side[1] < best[1] ? side : best))[0];
}

/** Where a port sits in the level's coordinates. */
function portPoint(rect: Rect, { side, offset }: End): Point {
  switch (side) {
    case 'left':
      return { x: rect.x, y: rect.y + rect.h / 2 + offset };
    case 'right':
      return { x: rect.x + rect.w, y: rect.y + rect.h / 2 + offset };
    case 'top':
      return { x: rect.x + rect.w / 2 + offset, y: rect.y };
    case 'bottom':
      return { x: rect.x + rect.w / 2 + offset, y: rect.y + rect.h };
  }
}

/**
 * Z routes (ports facing each other, not level) that share a port side at either end share a
 * corridor: their middle runs are spread up to `JOG_STEP` apart instead of lying on one another,
 * in the order that keeps them from crossing (going down, the one starting lower turns first;
 * going up, the one starting higher).
 */
function spreadCorridors(routes: Route[]): void {
  // Corridors as a union-find over the Z routes: each points towards its corridor's root.
  const corridor = new Map<Route, Route>();
  const root = (route: Route): Route => {
    let r = route;
    while (corridor.get(r) !== r) r = corridor.get(r) as Route;
    return r;
  };
  const bySide = new Map<string, Route>();
  for (const route of routes) {
    if (!isZ(route)) continue;
    corridor.set(route, route);
    const { from, to } = route.edge;
    for (const key of [`${from}\u0000${route.sourceSide}`, `${to}\u0000${route.targetSide}`]) {
      const other = bySide.get(key);
      if (other === undefined) bySide.set(key, route);
      else corridor.set(root(route), root(other));
    }
  }
  const groups = new Map<Route, Route[]>();
  for (const route of corridor.keys()) {
    groups.set(root(route), [...(groups.get(root(route)) ?? []), route]);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const across = (r: Route) => (horizontal(r.sourceSide) ? 'y' : 'x');
    const along = (r: Route) => (horizontal(r.sourceSide) ? 'x' : 'y');
    // The one furthest the way the edge steps turns first (smallest jog).
    const key = (r: Route) =>
      r.source[across(r)] * Math.sign(r.target[across(r)] - r.source[across(r)]);
    const room = Math.min(...list.map((r) => Math.abs(r.target[along(r)] - r.source[along(r)])));
    const step = Math.min(JOG_STEP, room / (2 * (list.length + 1)));
    list.sort((p, q) => key(q) - key(p));
    list.forEach((r, i) => (r.jog = (i - (list.length - 1) / 2) * step));
  }
}

/** True when the ports face each other with the target ahead and not level: drawn as a Z. */
function isZ(r: Route): boolean {
  if (OPPOSITE[r.sourceSide] !== r.targetSide) return false;
  const n = SIDE_AXES[r.sourceSide].n;
  const ahead = dot({ x: r.target.x - r.source.x, y: r.target.y - r.source.y }, n) > 0;
  const level = horizontal(r.sourceSide) ? r.source.y === r.target.y : r.source.x === r.target.x;
  return ahead && !level;
}

/**
 * The pairs of edges (by id) whose straight port-to-port lines cross: a measure of how tangled a
 * level reads (the drawn curves leave and enter their ports the same way).
 */
export function crossings(diagram: NeatDiagram): [string, string][] {
  const segments = [...layoutEdges(diagram)];
  const found: [string, string][] = [];
  segments.forEach(([id, a], i) => {
    for (const [other, b] of segments.slice(i + 1)) {
      if (intersect(a.source, a.target, b.source, b.target)) found.push([id, other]);
    }
  });
  return found;
}

/** True when the segments p1-p2 and p3-p4 cross properly (touching does not count). */
export function intersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const turn = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  return turn(p3, p4, p1) * turn(p3, p4, p2) < 0 && turn(p1, p2, p3) * turn(p1, p2, p4) < 0;
}
