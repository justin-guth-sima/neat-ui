import { absoluteRects, crossings, intersect, layoutEdges } from './layout';
import type { NeatDiagram, NeatDiagramEdge, NeatDiagramNode } from './model';
import { resetReported } from './report';
import { roundCorners, roundedPath, sampleRoute, type Point } from './route';
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
/** The first and last px of an edge, at its ports, are left out (neighbouring ports are close). */
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
        block('right', 400, 50),
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
    // A lone port sits in the middle of its side.
    expect(edges.get('r')).toMatchObject({ source: { x: 100, y: 50 }, target: { x: 400, y: 100 } });
  });

  it('takes a node’s inSide and outSide over the facing sides', () => {
    const edges = layoutEdges({
      nodes: [block('a', 0, 0, { outSide: 'top' }), block('b', 400, 0, { inSide: 'bottom' })],
      edges: [edge('ab', 'a', 'b')],
    });
    expect(edges.get('ab')).toMatchObject({ sourceSide: 'top', targetSide: 'bottom' });
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
      path: roundedPath({ x: 100, y: 50 }, 'right', { x: 400, y: 50 }, 'left'),
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
