import { neatDrillDownLevel } from './drill-down';
import { absoluteRects, crossings, layoutEdges } from './layout';
import type { NeatDiagram, NeatDiagramEdge, NeatDiagramNode } from './model';
import { resetReported } from './report';

const node = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<NeatDiagramNode> = {},
): NeatDiagramNode => ({ id, label: id, role: 'block', x, y, w, h, ...extra });

const edge = (id: string, from: string, to: string): NeatDiagramEdge => ({ id, from, to });

/**
 * A process with two steps and a group of one more inside, two cameras feeding it, a sink it feeds
 * and a node it has nothing to do with, placed as an overview would place them.
 */
const STEP1 = node('step1', 20, 40, 120, 60, { parent: 'proc' });
const STEP2 = node('step2', 200, 40, 120, 60, { parent: 'proc' });
const GROUP = node('group', 360, 20, 200, 160, { parent: 'proc', role: 'frame', look: 'dashed' });
const STEP3 = node('step3', 20, 40, 160, 60, { parent: 'group' });
const DIAGRAM: NeatDiagram = {
  nodes: [
    node('cam1', 0, 0, 200, 50, { outSide: 'top' }),
    node('cam2', 0, 100, 200, 50),
    node('proc', 400, 0, 260, 140, {
      detail: 'on the board',
      opens: 'proc',
      inSide: 'bottom',
      outSide: 'top',
      look: 'accent',
    }),
    STEP1,
    STEP2,
    GROUP,
    STEP3,
    node('sink', 900, 0, 200, 50, { opens: 'sink' }),
    node('other', 900, 500, 200, 50),
  ],
  edges: [
    edge('cam1>proc', 'cam1', 'proc'),
    edge('cam1>step1', 'cam1', 'step1'),
    edge('cam2>step1', 'cam2', 'step1'),
    edge('step1>step2', 'step1', 'step2'),
    edge('step2>step3', 'step2', 'step3'),
    edge('step3>sink', 'step3', 'sink'),
    edge('other>sink', 'other', 'sink'),
  ],
  notes: [{ id: 'overview-note', edges: ['cam1>proc'], dy: -100 }],
};

const byId = (level: NeatDiagram, id: string) => level.nodes.find((n) => n.id === id);

afterEach(() => resetReported());

describe('neatDrillDownLevel', () => {
  const level = neatDrillDownLevel(DIAGRAM, 'proc');
  const frame = byId(level, 'proc') as NeatDiagramNode;

  it('makes the block the level’s frame at the origin, its children inside a padding of 40', () => {
    // The group reaches furthest: right to 360 + 200, down to 20 + 160.
    expect(frame).toMatchObject({
      id: 'proc',
      label: 'proc',
      detail: 'on the board',
      role: 'frame',
      look: 'accent',
      x: 0,
      y: 0,
      w: 600,
      h: 220,
    });
    expect(frame.parent).toBeUndefined();
    // It is the level now: it opens nothing, and its sides were the overview's.
    expect(frame.opens).toBeUndefined();
    expect(frame.inSide).toBeUndefined();
    expect(frame.outSide).toBeUndefined();
  });

  it('keeps what is inside the block as it is, however deep', () => {
    for (const inside of [STEP1, STEP2, GROUP, STEP3]) expect(byId(level, inside.id)).toBe(inside);
    expect(absoluteRects(level).get('step3')).toEqual({ x: 380, y: 60, w: 160, h: 60 });
  });

  it('puts the senders in a column left of the frame, the receivers right of it, centered', () => {
    const senders = ['cam1', 'cam2'].map((id) => byId(level, id) as NeatDiagramNode);
    // Two blocks of 64 with 24 between them, centered on the frame's 220: from y 34.
    expect(senders.map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual([
      { x: -520, y: 34, w: 300, h: 64 },
      { x: -520, y: 122, w: 300, h: 64 },
    ]);
    const sink = byId(level, 'sink') as NeatDiagramNode;
    expect({ x: sink.x, y: sink.y, w: sink.w, h: sink.h }).toEqual({
      x: 820,
      y: 78,
      w: 300,
      h: 64,
    });
    for (const outside of [...senders, sink]) {
      expect(outside.parent).toBeUndefined();
      expect(outside.outSide).toBeUndefined();
    }
    // An outside block still opens its own level.
    expect(sink.opens).toBe('sink');
  });

  it('takes only the edges with an end inside the block, and no other node', () => {
    expect(level.edges.map((e) => e.id)).toEqual([
      'cam1>step1',
      'cam2>step1',
      'step1>step2',
      'step2>step3',
      'step3>sink',
    ]);
    expect(level.nodes.map((n) => n.id).sort()).toEqual(
      ['cam1', 'cam2', 'group', 'proc', 'sink', 'step1', 'step2', 'step3'].sort(),
    );
    // The overview's notes were placed for the overview.
    expect(level.notes ?? []).toEqual([]);
  });

  it('lays out as a level: every edge drawn, inputs in from the left, results out right', () => {
    const edges = layoutEdges(level);
    expect([...edges.keys()]).toHaveLength(level.edges.length);
    expect(crossings(level)).toEqual([]);
    expect(edges.get('cam1>step1')?.sourceSide).toBe('right');
    expect(edges.get('step3>sink')?.targetSide).toBe('left');
  });

  it('puts a node that both sends and receives in the senders’ column only, once', () => {
    const loop: NeatDiagram = {
      nodes: [...DIAGRAM.nodes],
      edges: [edge('cam1>step1', 'cam1', 'step1'), edge('step2>cam1', 'step2', 'cam1')],
    };
    const drilled = neatDrillDownLevel(loop, 'proc');
    const cams = drilled.nodes.filter((n) => n.id === 'cam1');
    expect(cams).toHaveLength(1);
    expect(cams[0].x).toBe(-520);
  });

  it('leaves out a node an edge names that does not exist, without throwing', () => {
    const broken: NeatDiagram = {
      nodes: [...DIAGRAM.nodes],
      edges: [edge('ghost>step1', 'ghost', 'step1'), edge('cam1>step1', 'cam1', 'step1')],
    };
    const drilled = neatDrillDownLevel(broken, 'proc');
    expect(drilled.nodes.some((n) => n.id === 'ghost')).toBe(false);
    // The single sender sits at the frame's middle.
    expect(byId(drilled, 'cam1')?.y).toBe(78);
  });

  it('gives an empty level for a block that is not there or holds nothing, naming it once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(neatDrillDownLevel(DIAGRAM, 'nowhere')).toEqual({ nodes: [], edges: [] });
      expect(neatDrillDownLevel(DIAGRAM, 'nowhere')).toEqual({ nodes: [], edges: [] });
      expect(neatDrillDownLevel(DIAGRAM, 'sink')).toEqual({ nodes: [], edges: [] });
      const messages = error.mock.calls.map((call) => String(call[0]));
      expect(messages.filter((m) => m.includes('"nowhere"'))).toHaveLength(1);
      expect(messages.filter((m) => m.includes('"sink"'))).toHaveLength(1);
    } finally {
      error.mockRestore();
    }
  });
});
