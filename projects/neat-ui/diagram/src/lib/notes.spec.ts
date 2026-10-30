import { layoutEdges } from './layout';
import type { NeatDiagram, NeatDiagramNode, NeatDiagramNote } from './model';
import { placeNotes } from './notes';
import { resetReported } from './report';

/*
 * The rules of the Autoware demo's note placement (its dot layer's annotations and
 * `annotation-placement.spec.ts`), in diagram units: the cards there are notes here.
 */

const block = (id: string, x: number, y: number): NeatDiagramNode => ({
  id,
  label: id,
  role: 'block',
  x,
  y,
  w: 100,
  h: 100,
});

/**
 * Two level edges 200 apart: `top` from (100, 50) to (400, 50), `low` from (100, 250) to
 * (400, 250). Their middles are (250, 50) and (250, 250).
 */
const NODES = [block('a', 0, 0), block('b', 400, 0), block('c', 0, 200), block('d', 400, 200)];
const EDGES = [
  { id: 'top', from: 'a', to: 'b' },
  { id: 'low', from: 'c', to: 'd' },
];

/** A note's box is 80 by 40 unless the spec measures it otherwise. */
const SIZE = { w: 80, h: 40 };

function place(notes: NeatDiagramNote[], sizes?: Map<string, { w: number; h: number }>) {
  const diagram: NeatDiagram = { nodes: NODES, edges: EDGES, notes };
  return placeNotes(
    diagram,
    layoutEdges(diagram),
    sizes ?? new Map(notes.map((n) => [n.id, SIZE])),
  );
}

afterEach(() => resetReported());

describe('placeNotes', () => {
  describe('the anchor', () => {
    it('lies halfway along the note’s edge, or at `along`', () => {
      const placed = place([
        { id: 'half', edges: ['top'], dy: -100 },
        { id: 'quarter', edges: ['top'], along: 0.25, dy: -100 },
      ]);
      expect(placed.get('half')?.anchor).toEqual({ x: 250, y: 50 });
      expect(placed.get('quarter')?.anchor).toEqual({ x: 175, y: 50 });
    });

    it('is the mean of the points of all its edges', () => {
      const placed = place([{ id: 'both', edges: ['top', 'low'], dx: 300 }]);
      expect(placed.get('both')?.anchor).toEqual({ x: 250, y: 150 });
    });

    it('is the `anchor` point when it has one; without x, at the edges’ mean x', () => {
      const placed = place([
        { id: 'point', edges: ['top'], anchor: { x: 10, y: 20 }, dy: -100 },
        { id: 'bundle', edges: ['top', 'low'], anchor: { y: 500 }, dy: 100 },
      ]);
      expect(placed.get('point')?.anchor).toEqual({ x: 10, y: 20 });
      expect(placed.get('bundle')?.anchor).toEqual({ x: 250, y: 500 });
    });

    it('needs no edge when its `anchor` point is whole (a note about a node)', () => {
      const placed = place([{ id: 'about-a', anchor: { x: 100, y: 50 }, dx: -200 }]);
      expect(placed.get('about-a')?.anchor).toEqual({ x: 100, y: 50 });
    });
  });

  describe('the box', () => {
    it('is centred on the anchor moved by `dx` and `dy`', () => {
      const placed = place([{ id: 'above', edges: ['top'], dx: 20, dy: -100 }]);
      expect(placed.get('above')?.box).toEqual({ x: 230, y: -70, w: 80, h: 40 });
    });

    it('is centred on `x` and `y` where it has them, per axis', () => {
      const placed = place([
        { id: 'fixed', edges: ['top'], x: 600, y: 400, dx: 999, dy: 999 },
        { id: 'fixed-x', edges: ['top'], x: 600, dy: 100 },
      ]);
      expect(placed.get('fixed')?.box).toEqual({ x: 560, y: 380, w: 80, h: 40 });
      expect(placed.get('fixed-x')?.box).toEqual({ x: 560, y: 130, w: 80, h: 40 });
    });

    it('takes its measured size', () => {
      const placed = place(
        [{ id: 'big', edges: ['top'], dy: -200 }],
        new Map([['big', { w: 184, h: 115 }]]),
      );
      expect(placed.get('big')?.box).toEqual({ x: 158, y: -207.5, w: 184, h: 115 });
    });
  });

  describe('the leader', () => {
    it('runs from the anchor to the box’s nearest point: upright, level, or to a corner', () => {
      const placed = place([
        { id: 'above', edges: ['top'], dy: -100 },
        { id: 'beside', edges: ['top'], dx: 200 },
        { id: 'corner', edges: ['top'], dx: 200, dy: 200 },
      ]);
      expect(placed.get('above')?.leader).toEqual([
        { x: 250, y: 50 },
        { x: 250, y: -30 },
      ]);
      expect(placed.get('beside')?.leader).toEqual([
        { x: 250, y: 50 },
        { x: 410, y: 50 },
      ]);
      expect(placed.get('corner')?.leader).toEqual([
        { x: 250, y: 50 },
        { x: 410, y: 230 },
      ]);
    });

    it('runs on to the box’s centre with `leaderTo: centre`', () => {
      const placed = place([
        { id: 'centre', edges: ['top'], dx: 200, dy: 200, leaderTo: 'centre' },
      ]);
      expect(placed.get('centre')?.leader).toEqual([
        { x: 250, y: 50 },
        { x: 450, y: 250 },
      ]);
    });

    it('is not drawn while the anchor is under the box', () => {
      const placed = place([
        { id: 'over', edges: ['top'], dx: 10 },
        { id: 'over-centre', edges: ['top'], dy: 5, leaderTo: 'centre' },
        { id: 'on-its-border', edges: ['top'], dy: -20 },
      ]);
      expect(placed.get('over')?.leader).toBeNull();
      expect(placed.get('over-centre')?.leader).toBeNull();
      expect(placed.get('on-its-border')?.leader).toBeNull();
    });
  });

  it('waits for a note’s size: a note not measured yet is not placed, and nothing is said', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const placed = place([{ id: 'unmeasured', edges: ['top'] }], new Map());
      expect(placed.size).toBe(0);
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('places a note by its other edges when one names no edge, naming that one once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const notes: NeatDiagramNote[] = [{ id: 'half-lost', edges: ['top', 'nowhere'], dy: -100 }];
      expect(place(notes).get('half-lost')?.anchor).toEqual({ x: 250, y: 50 });
      place(notes);
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][0])).toContain('"half-lost"');
      expect(String(error.mock.calls[0][0])).toContain('"nowhere"');
    } finally {
      error.mockRestore();
    }
  });

  it('leaves out a note with nothing to anchor it, naming it once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const notes: NeatDiagramNote[] = [
        { id: 'lost', edges: ['nowhere'] },
        { id: 'no-x', anchor: { y: 10 } },
        { id: 'kept', edges: ['top'], dy: -100 },
      ];
      expect([...place(notes).keys()]).toEqual(['kept']);
      place(notes);
      const messages = error.mock.calls.map((call) => String(call[0]));
      expect(messages.filter((m) => m.includes('note "lost" is left out'))).toHaveLength(1);
      expect(messages.filter((m) => m.includes('note "no-x" is left out'))).toHaveLength(1);
    } finally {
      error.mockRestore();
    }
  });

  it('does not name again an edge the layout left out, which the layout has named', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const diagram: NeatDiagram = {
        nodes: NODES,
        edges: [...EDGES, { id: 'dangling', from: 'a', to: 'gone' }],
        notes: [{ id: 'note', edges: ['top', 'dangling'], dy: -100 }],
      };
      const edges = layoutEdges(diagram);
      error.mockClear();
      const placed = placeNotes(diagram, edges, new Map([['note', SIZE]]));
      expect(placed.get('note')?.anchor).toEqual({ x: 250, y: 50 });
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('keeps the first of two notes with one id and names the later one once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const placed = place([
        { id: 'twice', edges: ['top'], dy: -100 },
        { id: 'twice', edges: ['low'], dy: 100 },
      ]);
      expect(placed.get('twice')?.anchor).toEqual({ x: 250, y: 50 });
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][0])).toContain('note "twice"');
    } finally {
      error.mockRestore();
    }
  });
});
