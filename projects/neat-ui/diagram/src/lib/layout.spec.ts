import tokens from '../../../src/lib/theme/tokens.generated.css' with { loader: 'text' };
import {
  absoluteRects,
  CORNER,
  crossings,
  type EdgeLayout,
  intersect,
  layoutEdges,
  type Rect,
} from './layout';
import type { NeatDiagram, NeatDiagramEdge, NeatDiagramNode } from './model';
import { resetReported } from './report';
import { roundCorners, sampleRoute, type Point } from './route';
import { SYSTEM_LEVELS } from './system-levels.testing';

/** Each edge of a level as drawn in the rounded shape, as a polyline (turns sampled). */
function drawnEdges(diagram: NeatDiagram): Map<string, Point[]> {
  return new Map(
    [...layoutEdges(diagram)].map(([id, e]) => [
      id,
      sampleRoute(e.points[0], roundCorners(e.points)),
    ]),
  );
}

/** The pairs of edges whose drawn (rounded) shapes cross; shared ends do not count. */
function drawnCrossings(diagram: NeatDiagram): [string, string][] {
  const lines = [...drawnEdges(diagram)];
  const found: [string, string][] = [];
  lines.forEach(([id, p], i) => {
    for (const [other, q] of lines.slice(i + 1)) {
      const hit = p.slice(1).some((a, j) => q.slice(1).some((b, k) => intersect(p[j], a, q[k], b)));
      if (hit) found.push([id, other]);
    }
  });
  return found;
}

/**
 * How close (px) two drawn edges may come along one another, and for how long, before they read
 * as one.
 */
const NEAR = 2;
const OVERLAP_MAX = 4;
/** The first and last px of an edge, at its ports, are left out (neighboring ports are close). */
const END_SKIP = 6;

/** Points 1 px apart along a polyline, with the distance from its start. */
function densify(points: Point[]): { p: Point; at: number }[] {
  const out: { p: Point; at: number }[] = [];
  let at = 0;
  points.slice(1).forEach((b, i) => {
    const a = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(length));
    for (let k = 0; k < n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
      out.push({ p, at: at + (length * k) / n });
    }
    at += length;
  });
  out.push({ p: points[points.length - 1], at });
  return out;
}

function distance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t =
    dx || dy
      ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
      : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/**
 * The pairs of edges whose drawn shapes run along one another: more than OVERLAP_MAX px of one
 * within NEAR px of the other (a shared corridor or run that a crossing check cannot see).
 */
function drawnOverlaps(diagram: NeatDiagram): [string, string][] {
  const lines = [...drawnEdges(diagram)].map(([id, points]) => {
    const dense = densify(points);
    const total = dense[dense.length - 1].at;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return {
      id,
      points,
      dense: dense.filter((d) => d.at > END_SKIP && d.at < total - END_SKIP).map((d) => d.p),
      box: {
        x0: Math.min(...xs) - NEAR,
        x1: Math.max(...xs) + NEAR,
        y0: Math.min(...ys) - NEAR,
        y1: Math.max(...ys) + NEAR,
      },
    };
  });
  const found: [string, string][] = [];
  lines.forEach((a, i) => {
    for (const b of lines.slice(i + 1)) {
      const close = a.dense.filter(
        (p) =>
          p.x >= b.box.x0 &&
          p.x <= b.box.x1 &&
          p.y >= b.box.y0 &&
          p.y <= b.box.y1 &&
          b.points.slice(1).some((q, k) => distance(p, b.points[k], q) <= NEAR),
      );
      if (close.length > OVERLAP_MAX) found.push([a.id, b.id]);
    }
  });
  return found;
}

/** The edges whose drawn shape runs through a card: a block or a bracket (frames hold edges). */
function throughCards(diagram: NeatDiagram): string[] {
  const rects = absoluteRects(diagram);
  const cards = diagram.nodes
    .filter((node) => node.role === 'block' || node.role === 'bracket')
    .map((node) => rects.get(node.id) as { x: number; y: number; w: number; h: number });
  const inside = (p: Point) =>
    cards.some((r) => p.x > r.x + 1 && p.x < r.x + r.w - 1 && p.y > r.y + 1 && p.y < r.y + r.h - 1);
  const hits: string[] = [];
  for (const [id, points] of drawnEdges(diagram)) {
    // Every sample, and the middle of every straight run (a run may cross a card between samples).
    const mids = points
      .slice(1)
      .map((p, i) => ({ x: (p.x + points[i].x) / 2, y: (p.y + points[i].y) / 2 }));
    if ([...points, ...mids].some(inside)) hits.push(id);
  }
  return hits;
}

const block = (
  id: string,
  x: number,
  y: number,
  extra: Partial<NeatDiagramNode> = {},
): NeatDiagramNode => ({ id, label: id, role: 'block', x, y, w: 100, h: 100, ...extra });

const edge = (id: string, from: string, to: string): NeatDiagramEdge => ({ id, from, to });

// Each problem is said once per run, and the runner shares modules between spec files: forget what
// was said, so a later spec's message is not swallowed by an earlier one's.
afterEach(() => resetReported());

describe('absoluteRects', () => {
  it('positions are relative to the parent: a child is placed in its frame', () => {
    const rects = absoluteRects({
      nodes: [
        block('frame', 1000, 0, { role: 'frame', w: 300, h: 300 }),
        block('child', 10, 10, { parent: 'frame' }),
      ],
      edges: [],
    });
    expect(rects.get('frame')).toEqual({ x: 1000, y: 0, w: 300, h: 300 });
    expect(rects.get('child')).toEqual({ x: 1010, y: 10, w: 100, h: 100 });
  });

  it('adds up the parents three frames deep, whatever order the nodes come in', () => {
    const rects = absoluteRects({
      nodes: [
        block('c', 2, 1, { parent: 'b' }),
        block('b', 5, 1, { parent: 'a', role: 'frame' }),
        block('a', 10, 1, { role: 'frame' }),
      ],
      edges: [],
    });
    expect(rects.get('c')).toMatchObject({ x: 17, y: 3 });
  });

  it('leaves out a node with an unknown parent or that is its own ancestor, naming it once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const diagram: NeatDiagram = {
        nodes: [
          block('lost', 0, 0, { parent: 'nowhere' }),
          block('inside-lost', 0, 0, { parent: 'lost' }),
          block('loop-a', 0, 0, { parent: 'loop-b' }),
          block('loop-b', 0, 0, { parent: 'loop-a' }),
          block('kept', 0, 0),
        ],
        edges: [],
      };
      expect([...absoluteRects(diagram).keys()]).toEqual(['kept']);
      absoluteRects(diagram);
      const messages = error.mock.calls.map((call) => String(call[0]));
      expect(messages.filter((m) => m.includes('"lost"') && m.includes('"nowhere"'))).toHaveLength(
        1,
      );
      expect(messages.filter((m) => m.includes('"loop-'))).toHaveLength(1);
    } finally {
      error.mockRestore();
    }
  });

  it('keeps the first of two nodes with one id and names the later one once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const diagram: NeatDiagram = {
        nodes: [block('a', 0, 0), block('b', 400, 0), block('a', 900, 900)],
        edges: [],
      };
      expect(absoluteRects(diagram).get('a')).toMatchObject({ x: 0, y: 0 });
      absoluteRects(diagram);
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][0])).toContain('node "a"');
    } finally {
      error.mockRestore();
    }
  });
});

describe('layoutEdges', () => {
  it('puts each edge end on the side facing the other node', () => {
    const edges = layoutEdges({
      nodes: [
        block('a', 0, 0),
        block('right', 400, 150),
        block('below', 0, 400),
        block('left', -400, 0),
      ],
      edges: [edge('r', 'a', 'right'), edge('b', 'a', 'below'), edge('l', 'a', 'left')],
    });
    expect([...edges].map(([id, e]) => [id, e.sourceSide, e.targetSide])).toEqual([
      ['r', 'right', 'left'],
      ['b', 'bottom', 'top'],
      ['l', 'left', 'right'],
    ]);
    // A lone port sits in the middle of its side (between boxes that do not overlap across).
    expect(edges.get('r')).toMatchObject({ source: { x: 100, y: 50 }, target: { x: 400, y: 200 } });
  });

  it('takes a node’s inSide and outSide over the facing sides', () => {
    const edges = layoutEdges({
      nodes: [block('a', 0, 0, { outSide: 'top' }), block('b', 400, 0, { inSide: 'bottom' })],
      edges: [edge('ab', 'a', 'b')],
    });
    expect(edges.get('ab')).toMatchObject({ sourceSide: 'top', targetSide: 'bottom' });
  });

  it('takes an edge’s fromSide and toSide over its nodes’ outSide and inSide, for that edge only', () => {
    const edges = layoutEdges({
      nodes: [
        block('a', 0, 0, { outSide: 'right', inSide: 'left' }),
        block('b', 400, 0, { inSide: 'left' }),
        block('c', 400, 300, { inSide: 'left' }),
      ],
      edges: [{ ...edge('ab', 'a', 'b'), fromSide: 'top', toSide: 'top' }, edge('ac', 'a', 'c')],
    });

    expect(edges.get('ab')).toMatchObject({ sourceSide: 'top', targetSide: 'top' });
    expect(edges.get('ac'), 'the node’s other edge keeps its outSide and inSide').toMatchObject({
      sourceSide: 'right',
      targetSide: 'left',
    });
  });

  it('routes an edge from the side it chose: its port and first corner lie on that side', () => {
    const edges = layoutEdges({
      nodes: [block('a', 0, 0), block('b', 400, 0)],
      edges: [{ ...edge('ab', 'a', 'b'), fromSide: 'top' }],
    });
    const route = edges.get('ab');

    expect(route?.sourceSide).toBe('top');
    expect(route?.source).toEqual({ x: 50, y: 0 });
    expect(route?.targetSide, 'an unset toSide is the facing side').toBe('left');
    expect(route?.points[1].x, 'it leaves upward first').toBe(50);
    expect(route?.points[1].y).toBeLessThan(0);
  });

  it('gives each edge its route’s corners and its rounded path', () => {
    const edges = layoutEdges({
      nodes: [block('a', 0, 0), block('b', 400, 0)],
      edges: [edge('ab', 'a', 'b')],
    });
    expect(edges.get('ab')).toEqual({
      source: { x: 100, y: 50 },
      sourceSide: 'right',
      target: { x: 400, y: 50 },
      targetSide: 'left',
      path: 'M 100 50 L 400 50',
      points: [
        { x: 100, y: 50 },
        { x: 400, y: 50 },
      ],
    });
  });

  it('spreads a side’s ports evenly about its middle, ordered by where the other ends are', () => {
    const edges = layoutEdges({
      nodes: [
        block('hub', 0, 0),
        block('low', 400, 300),
        block('high', 400, -300),
        block('mid', 400, 0),
      ],
      edges: [edge('low', 'hub', 'low'), edge('high', 'hub', 'high'), edge('mid', 'hub', 'mid')],
    });
    expect([...edges].map(([id, e]) => [id, e.source.y - 50])).toEqual([
      ['low', 10],
      ['high', -10],
      ['mid', 0],
    ]);
  });

  it('a three-way fan from one side does not cross itself', () => {
    const diagram: NeatDiagram = {
      nodes: [
        block('hub', 0, 0),
        block('low', 300, 200),
        block('high', 300, -200),
        block('mid', 300, 0),
      ],
      edges: [edge('low', 'hub', 'low'), edge('mid', 'hub', 'mid'), edge('high', 'hub', 'high')],
    };
    expect([...layoutEdges(diagram).values()].every((e) => e.sourceSide === 'right')).toBe(true);
    expect(crossings(diagram)).toEqual([]);
    expect(drawnCrossings(diagram)).toEqual([]);
  });

  it('places the ends of a node nested three frames deep at its absolute position', () => {
    const edges = layoutEdges({
      nodes: [
        block('a', 10, 0, { role: 'frame', w: 600, h: 600 }),
        block('b', 5, 0, { parent: 'a', role: 'frame', w: 500, h: 500 }),
        block('c', 2, 0, { parent: 'b' }),
        block('outside', -400, 0),
      ],
      edges: [edge('in', 'outside', 'c')],
    });
    expect(edges.get('in')).toMatchObject({ targetSide: 'left', target: { x: 17, y: 50 } });
  });

  it('runs an edge between a frame and a node inside it inside the frame, from its nearest border', () => {
    // The drilled block as its level's frame, with an edge to one of its own children and back.
    const diagram: NeatDiagram = {
      nodes: [
        block('frame', 0, 0, { role: 'frame', w: 500, h: 160 }),
        block('first', 20, 20, { parent: 'frame', w: 100, h: 40 }),
        block('inner', 200, 80, { parent: 'frame', w: 100, h: 40 }),
      ],
      edges: [edge('down', 'frame', 'inner'), edge('up', 'inner', 'frame')],
    };
    const edges = layoutEdges(diagram);
    // The frame's bottom border is 40 below the node, nearer than its other borders.
    expect(edges.get('down')).toMatchObject({ targetSide: 'bottom' });
    expect(edges.get('down')?.source.y).toBe(160);
    expect(edges.get('up')).toMatchObject({ sourceSide: 'bottom' });
    expect(edges.get('up')?.target.y).toBe(160);
    for (const [id, points] of drawnEdges(diagram)) {
      const outside = points.filter((p) => p.x < 0 || p.x > 500 || p.y < 0 || p.y > 160);
      expect(outside, id).toEqual([]);
    }
    expect(throughCards(diagram)).toEqual([]);
  });

  it('keeps a frame’s own sides for its outside neighbors, not for the nodes inside it', () => {
    // outSide and inSide say where the frame meets the nodes around it; inside, the nearest border.
    const diagram: NeatDiagram = {
      nodes: [
        block('frame', 0, 0, { role: 'frame', w: 500, h: 160, outSide: 'right', inSide: 'left' }),
        block('inner', 200, 80, { parent: 'frame', w: 100, h: 40 }),
        block('sink', 700, 50, { w: 100, h: 40 }),
      ],
      edges: [
        edge('down', 'frame', 'inner'),
        edge('up', 'inner', 'frame'),
        edge('out', 'frame', 'sink'),
      ],
    };
    const edges = layoutEdges(diagram);
    expect(edges.get('down')?.source.y).toBe(160);
    expect(edges.get('up')?.target.y).toBe(160);
    expect(edges.get('out')).toMatchObject({ sourceSide: 'right', source: { x: 500 } });
  });

  it('runs an edge from a frame to a node two frames inside it within the outer frame', () => {
    const diagram: NeatDiagram = {
      nodes: [
        block('outer', 0, 0, { role: 'frame', w: 600, h: 300 }),
        block('group', 100, 60, { parent: 'outer', role: 'frame', w: 400, h: 200 }),
        block('deep', 150, 40, { parent: 'group', w: 100, h: 40 }),
      ],
      edges: [edge('in', 'outer', 'deep')],
    };
    const edges = layoutEdges(diagram);
    // `deep` sits at 250..350 × 100..140: the outer frame's top border, 100 above it, is nearest.
    expect(edges.get('in')).toMatchObject({ targetSide: 'top', source: { y: 0 } });
    const points = drawnEdges(diagram).get('in') ?? [];
    expect(points.filter((p) => p.x < 0 || p.x > 600 || p.y < 0 || p.y > 300)).toEqual([]);
    expect(throughCards(diagram)).toEqual([]);
  });

  it('keeps the ports of a side inside it however many there are', () => {
    const many = Array.from({ length: 30 }, (_, i) => block(`t${i}`, 400, i * 10));
    const edges = layoutEdges({
      nodes: [block('hub', 0, 0), ...many],
      edges: many.map((b) => edge(b.id, 'hub', b.id)),
    });
    const offsets = [...edges.values()].map((e) => e.source.y - 50);
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(40);
  });

  it('leaves out an edge to an unknown node, naming it once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const diagram: NeatDiagram = {
        nodes: [block('a', 0, 0), block('b', 400, 0)],
        edges: [edge('ab', 'a', 'b'), edge('dangling', 'a', 'ghost-node')],
      };
      expect([...layoutEdges(diagram).keys()]).toEqual(['ab']);
      layoutEdges(diagram);
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][0])).toContain('"dangling"');
      expect(String(error.mock.calls[0][0])).toContain('"ghost-node"');
    } finally {
      error.mockRestore();
    }
  });

  it('says an edge’s end is left out itself, not missing, when it could not be placed', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const diagram: NeatDiagram = {
        nodes: [block('a', 0, 0), block('lost', 400, 0, { parent: 'nowhere' })],
        edges: [edge('to-lost', 'a', 'lost')],
      };
      expect([...layoutEdges(diagram).keys()]).toEqual([]);
      const messages = error.mock.calls.map((call) => String(call[0]));
      const about = messages.filter((m) => m.includes('"to-lost"'));
      expect(about).toHaveLength(1);
      expect(about[0]).toContain('"lost"');
      expect(about[0]).not.toContain('not on its level');
    } finally {
      error.mockRestore();
    }
  });

  it('keeps the first of two edges with one id and names the later one once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const diagram: NeatDiagram = {
        // Both leave from a's right side: the later one, kept, would take a port of its own.
        nodes: [block('a', 0, 0), block('b', 400, 0), block('b2', 400, 300)],
        edges: [edge('e', 'a', 'b'), edge('e', 'a', 'b2')],
      };
      const edges = layoutEdges(diagram);
      expect(edges.size).toBe(1);
      expect(edges.get('e')).toMatchObject({
        source: { x: 100, y: 50 },
        sourceSide: 'right',
        target: { x: 400, y: 50 },
      });
      layoutEdges(diagram);
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][0])).toContain('edge "e"');
    } finally {
      error.mockRestore();
    }
  });

  it('Z edges sharing a port side spread their middle runs apart', () => {
    const yolox = SYSTEM_LEVELS.find(([name]) => name === 'yolox_multi')?.[1] as NeatDiagram;
    const edges = layoutEdges(yolox);
    // Each is a Z leftwards or rightwards: its middle run is upright, at its second corner's x.
    const middles = [0, 1, 2, 3, 4, 5].map((i) => {
      const points = edges.get(`rois${i}<yolox_multi.publish`)?.points as Point[];
      expect(points).toHaveLength(4);
      return points[1].x;
    });
    expect(new Set(middles).size).toBe(6);
    // Spread over the middle half of the corridor between the publishing block and the Gateway.
    const spread = Math.max(...middles) - Math.min(...middles);
    expect(spread).toBeGreaterThan(50);
    expect(spread).toBeLessThan(140);
  });
});

describe('layoutEdges, edges that share a loop', () => {
  const side = (e: NeatDiagramEdge, fromSide: NeatDiagramEdge['fromSide'], toSide = fromSide) => ({
    ...e,
    fromSide,
    toSide,
  });

  it('spreads U routes between the same sides, nested so they do not cross', () => {
    // Two blocks on one row; two edges leave the first's top and enter the second's top.
    const level: NeatDiagram = {
      nodes: [block('a', 0, 100), block('b', 300, 100)],
      edges: [side(edge('one', 'a', 'b'), 'top'), side(edge('two', 'a', 'b'), 'top')],
    };
    expect(drawnOverlaps(level)).toEqual([]);
    expect(drawnCrossings(level)).toEqual([]);
    // The outer pair of ports (the wider span) loops higher.
    const routes = layoutEdges(level);
    const top = (id: string) => Math.min(...routes.get(id)!.points.map((p) => p.y));
    const span = (id: string) => Math.abs(routes.get(id)!.target.x - routes.get(id)!.source.x);
    const [outer, inner] = span('one') > span('two') ? ['one', 'two'] : ['two', 'one'];
    expect(top(outer)).toBeLessThan(top(inner));
  });

  it('spreads routes that run back behind their source between facing sides', () => {
    // The target lies behind: out of the first's right side, into the second's left side.
    const level: NeatDiagram = {
      nodes: [block('a', 300, 0), block('b', 0, 300)],
      edges: [
        side(edge('one', 'a', 'b'), 'right', 'left'),
        side(edge('two', 'a', 'b'), 'right', 'left'),
      ],
    };
    expect(drawnOverlaps(level)).toEqual([]);
    expect(drawnCrossings(level)).toEqual([]);
  });
});

describe('layoutEdges, placed by the app', () => {
  it('pins a port where `fromAt` and `toAt` say along its side', () => {
    const level: NeatDiagram = {
      nodes: [block('a', 0, 0), block('b', 300, 0)],
      edges: [{ ...edge('one', 'a', 'b'), fromAt: 0.25, toAt: 1 }, edge('two', 'a', 'b')],
    };
    const one = layoutEdges(level).get('one')!;
    // Right side of a (x 100, y 0 to 100), a quarter down; left side of b, at its bottom.
    expect(one.source).toEqual({ x: 100, y: 25 });
    expect(one.target).toEqual({ x: 300, y: 100 });
  });

  it('runs an edge with `via` through its corners, and spreads no corridor for it', () => {
    const via = [
      { x: 150, y: 50 },
      { x: 150, y: -60 },
      { x: 250, y: -60 },
      { x: 250, y: 50 },
    ];
    const level: NeatDiagram = {
      nodes: [block('a', 0, 0), block('b', 300, 0)],
      edges: [{ ...edge('one', 'a', 'b'), via }],
    };
    const one = layoutEdges(level).get('one')!;
    expect(one.points).toEqual([one.source, ...via, one.target]);
    expect(one.path.startsWith(`M ${one.source.x} ${one.source.y}`)).toBe(true);
  });

  it('routes an edge itself when its `via` holds a point that is no number', () => {
    const level: NeatDiagram = {
      nodes: [block('a', 0, 0), block('b', 300, 0)],
      edges: [{ ...edge('one', 'a', 'b'), via: [{ x: Number.NaN, y: 0 }] }],
    };
    expect(layoutEdges(level).get('one')!.points).toHaveLength(2);
  });
});

describe('layoutEdges, facing boxes that overlap across', () => {
  /** Whether a port lies on its node's side, within the side's extent. */
  const onItsSide = (diagram: NeatDiagram, id: string, end: 'source' | 'target'): boolean => {
    const e = layoutEdges(diagram).get(id) as EdgeLayout;
    const r = absoluteRects(diagram).get(
      end === 'source' ? edgeById(diagram, id).from : edgeById(diagram, id).to,
    ) as Rect;
    const p = e[end];
    const side = end === 'source' ? e.sourceSide : e.targetSide;
    const within = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
    switch (side) {
      case 'left':
        return p.x === r.x && within(p.y, r.y, r.y + r.h);
      case 'right':
        return p.x === r.x + r.w && within(p.y, r.y, r.y + r.h);
      case 'top':
        return p.y === r.y && within(p.x, r.x, r.x + r.w);
      case 'bottom':
        return p.y === r.y + r.h && within(p.x, r.x, r.x + r.w);
    }
  };
  const edgeById = (diagram: NeatDiagram, id: string) =>
    diagram.edges.find((e) => e.id === id) as NeatDiagramEdge;

  // A node with two outputs on its right, one to a box straight across whose center is 4 below.
  const fan: NeatDiagram = {
    nodes: [block('hub', 0, 0), block('near', 300, 4), block('far', 300, 300)],
    edges: [edge('near', 'hub', 'near'), edge('far', 'hub', 'far')],
  };

  it('runs an edge straight from a fanning side to a box across, at the fan’s port', () => {
    const edges = layoutEdges(fan);
    const near = edges.get('near') as EdgeLayout;
    expect(near.points).toHaveLength(2);
    expect(near.source.y).toBe(near.target.y);
    // The fan keeps its spread port, so it keeps its order: the near edge's port above the far one's.
    expect(near.source.y).toBe(45);
    expect(near.source.y).toBeLessThan((edges.get('far') as EdgeLayout).source.y);
    // The far box does not overlap the hub: its edge is still a Z.
    expect(edges.get('far')?.points).toHaveLength(4);
    expect(drawnCrossings(fan)).toEqual([]);
  });

  it('runs an edge straight into a side with several inputs, at that side’s port', () => {
    const diagram: NeatDiagram = {
      nodes: [block('src', 0, 0), block('sink', 300, 4), block('other', 0, 300)],
      edges: [edge('in', 'src', 'sink'), edge('low', 'other', 'sink')],
    };
    const edges = layoutEdges(diagram);
    const into = edges.get('in') as EdgeLayout;
    expect(into.points).toHaveLength(2);
    // The sink's two inputs are spread 10 apart about its middle (54): the upper one is this edge's.
    expect(into.target.y).toBe(49);
    expect(into.source.y).toBe(49);
    expect(into.target.y).toBeLessThan((edges.get('low') as EdgeLayout).target.y);
    expect(edges.get('low')?.points).toHaveLength(4);
  });

  it('meets a lone port at the target’s center, or the overlap’s middle when that is outside it', () => {
    const centered = layoutEdges({
      nodes: [block('a', 0, 0), block('b', 300, 6)],
      edges: [edge('ab', 'a', 'b')],
    }).get('ab') as EdgeLayout;
    expect(centered.points).toEqual([
      { x: 100, y: 56 },
      { x: 300, y: 56 },
    ]);

    // b spans 70..170 and a 0..100: b's center (120) is outside the overlap, clear of the corners
    // (78..92), so the edge runs at its middle.
    const offset = layoutEdges({
      nodes: [block('a', 0, 0), block('b', 300, 70)],
      edges: [edge('ab', 'a', 'b')],
    }).get('ab') as EdgeLayout;
    expect(offset.points).toEqual([
      { x: 100, y: 85 },
      { x: 300, y: 85 },
    ]);
  });

  it('runs top to bottom straight as well, across x', () => {
    const edges = layoutEdges({
      nodes: [block('a', 0, 0), block('b', 6, 300)],
      edges: [edge('ab', 'a', 'b')],
    });
    expect(edges.get('ab')).toMatchObject({
      sourceSide: 'bottom',
      targetSide: 'top',
      points: [
        { x: 56, y: 100 },
        { x: 56, y: 300 },
      ],
    });
  });

  it('keeps clear of the corners by the theme’s radius, at zoom 1', () => {
    const radius = /--radius:\s*([\d.]+)rem;/.exec(tokens)?.[1];
    expect(radius).toBeDefined();
    expect(CORNER).toBe(Number(radius) * 16);
  });

  it('keeps a Z between boxes that do not overlap, or overlap only at their corners', () => {
    for (const y of [150, 90]) {
      const edges = layoutEdges({
        nodes: [block('a', 0, 0), block('b', 300, y)],
        edges: [edge('ab', 'a', 'b')],
      });
      expect([y, edges.get('ab')?.points]).toEqual([
        y,
        [
          { x: 100, y: 50 },
          { x: 200, y: 50 },
          { x: 200, y: y + 50 },
          { x: 300, y: y + 50 },
        ],
      ]);
    }
  });

  it('leaves an edge that already runs straight where it is', () => {
    const edges = layoutEdges({
      nodes: [
        block('hub', 0, 0),
        block('up', 300, -300),
        block('mid', 300, 0),
        block('down', 300, 300),
      ],
      edges: [edge('up', 'hub', 'up'), edge('mid', 'hub', 'mid'), edge('down', 'hub', 'down')],
    });
    expect(edges.get('mid')?.points).toEqual([
      { x: 100, y: 50 },
      { x: 300, y: 50 },
    ]);
    expect(edges.get('up')?.source.y).toBe(40);
    expect(edges.get('down')?.source.y).toBe(60);
  });

  it('keeps two straight edges into one side from two sources apart and in order', () => {
    const diagram: NeatDiagram = {
      nodes: [block('s1', 0, 10), block('s2', 0, 110), block('t', 300, 0, { h: 200 })],
      edges: [edge('one', 's1', 't'), edge('two', 's2', 't')],
    };
    const edges = layoutEdges(diagram);
    const one = edges.get('one') as EdgeLayout;
    const two = edges.get('two') as EdgeLayout;
    expect(one.points).toHaveLength(2);
    expect(two.points).toHaveLength(2);
    // The target's spread ports are 95 and 105; 105 is above s2's, which meets it at its top
    // clear of the corner (118).
    expect(one.target.y).toBe(95);
    expect(two.target.y).toBe(118);
    expect(drawnCrossings(diagram)).toEqual([]);
  });

  it('keeps every port on its node’s side, within the side’s extent', () => {
    const many: NeatDiagram = {
      nodes: [
        block('hub', 0, 0),
        ...[-60, -20, 3, 40, 95].map((y, i) => block(`t${i}`, 300, y, { h: 30 })),
        block('src', -300, 70),
      ],
      edges: [
        ...[0, 1, 2, 3, 4].map((i) => edge(`e${i}`, 'hub', `t${i}`)),
        edge('in', 'src', 'hub'),
      ],
    };
    const fanCase = fan;
    for (const diagram of [many, fanCase]) {
      for (const e of diagram.edges) {
        expect([
          e.id,
          onItsSide(diagram, e.id, 'source'),
          onItsSide(diagram, e.id, 'target'),
        ]).toEqual([e.id, true, true]);
      }
      expect(drawnCrossings(diagram)).toEqual([]);
    }
  });
});

describe('crossings', () => {
  it('counts the edges whose straight lines cross', () => {
    const diagram: NeatDiagram = {
      nodes: [block('a', 0, 0), block('b', 0, 400), block('c', 400, 0), block('d', 400, 400)],
      edges: [edge('ad', 'a', 'd'), edge('bc', 'b', 'c'), edge('ac', 'a', 'c')],
    };
    expect(crossings(diagram)).toEqual([['ad', 'bc']]);
  });
});

describe('the Autoware demo’s System page', () => {
  const overview = SYSTEM_LEVELS[0][1];

  it('has no crossings on any level: inputs go in, results come out', () => {
    for (const [name, level] of SYSTEM_LEVELS) {
      expect([name, crossings(level)]).toEqual([name, []]);
    }
  });

  it('meets the processes below and leaves them above, as their inSide and outSide say', () => {
    const edges = [...layoutEdges(overview)];
    for (const node of ['traffic_light', 'yolox_multi', 'centerpoint', 'sysmon']) {
      const into = overview.edges.filter((e) => e.to === node).map((e) => e.id);
      const out = overview.edges.filter((e) => e.from === node).map((e) => e.id);
      for (const [id, e] of edges) {
        if (into.includes(id)) expect([id, e.targetSide]).toEqual([id, 'bottom']);
        if (out.includes(id)) expect([id, e.sourceSide]).toEqual([id, 'top']);
      }
    }
  });

  it('hangs the ghost edges off the Gateway’s left', () => {
    const edges = layoutEdges(overview);
    const ghosts = overview.edges.filter((e) => e.line === 'ghost' && e.from === 'gateway');
    expect(ghosts.length).toBeGreaterThan(0);
    for (const ghost of ghosts) expect(edges.get(ghost.id)?.sourceSide).toBe('left');
  });

  it('drawn in the rounded shape, no edge crosses another or runs through a card', () => {
    for (const [name, level] of SYSTEM_LEVELS) {
      expect([name, drawnCrossings(level)]).toEqual([name, []]);
      expect([name, throughCards(level)]).toEqual([name, []]);
    }
  });

  it('drawn rounded, no two edges run along one another (shared corridors are spread)', () => {
    for (const [name, level] of SYSTEM_LEVELS) {
      expect([name, drawnOverlaps(level)]).toEqual([name, []]);
    }
  });
});
