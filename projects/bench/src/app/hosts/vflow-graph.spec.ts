import type { NeatDiagramNode } from '@sima/neat-ui/diagram';
import type { Curve, CurveFactory, CurveFactoryParams, Edge, Node } from 'ngx-vflow';
import { D1, synthDiagram } from '../synth/synth-diagram';
import { NOTE_BOX } from './bench-note';
import { sceneOf } from './scene';
import { type VflowLine, type VflowPart, vflowGraph } from './vflow-graph';

describe('vflowGraph', () => {
  const synth = synthDiagram(D1, 3);
  const overview = synth.diagram.overview;
  const scene = sceneOf(synth);
  const { nodes, edges } = vflowGraph(overview, scene);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  /** A vflow edge's layout: its curve called as vflow calls it (it ignores vflow's points). */
  const layoutOf = (edge: Edge<VflowLine>) => {
    const curve = edge.curve?.() as Curve;
    return (curve as CurveFactory)({ mode: 'edge', edge } as unknown as CurveFactoryParams);
  };
  const dataOf = (node: Node<VflowPart>) => ('data' in node ? node.data?.() : undefined);

  it('puts every frame and block where the kit puts it, by its parent, and none draggable', () => {
    const placed = overview.nodes.map((node: NeatDiagramNode) => {
      const drawn = byId.get(node.id)!;
      return {
        id: drawn.id,
        point: drawn.point(),
        parent: drawn.parentId?.(),
        w: 'width' in drawn ? drawn.width?.() : undefined,
        h: 'height' in drawn ? drawn.height?.() : undefined,
        draggable: drawn.draggable?.(),
      };
    });
    expect(placed).toEqual(
      overview.nodes.map((node) => ({
        id: node.id,
        point: { x: node.x, y: node.y },
        parent: node.parent ?? null,
        w: node.w,
        h: node.h,
        draggable: false,
      })),
    );
  });

  it('draws frames as SVG groups and blocks as HTML, as the demo did, frames first', () => {
    const frames = overview.nodes.filter((node) => node.role === 'frame');
    for (const node of overview.nodes) {
      const drawn = byId.get(node.id)!;
      expect(drawn.type).toBe(node.role === 'frame' ? 'template-group' : 'html-template');
      expect(dataOf(drawn)).toEqual({ kind: node.role === 'frame' ? 'frame' : 'block', node });
    }
    expect(nodes.slice(0, frames.length).map((node) => node.id)).toEqual(frames.map((f) => f.id));
  });

  it('puts every note at the box the kit places it in, as HTML naming its edge', () => {
    for (const note of overview.notes ?? []) {
      const drawn = byId.get(`note:${note.id}`)!;
      const { box } = scene.notes.get(note.id)!;
      expect(drawn.type).toBe('html-template');
      expect(drawn.point()).toEqual({ x: box.x, y: box.y });
      expect('width' in drawn && drawn.width?.()).toBe(NOTE_BOX.w);
      expect('height' in drawn && drawn.height?.()).toBe(NOTE_BOX.h);
      expect(dataOf(drawn)).toEqual({ kind: 'note', note, edge: note.edges?.[0] });
    }
  });

  it('draws every edge on the kit’s route, with its label where the kit centers it', () => {
    const lines = edges.filter((edge) => edge.data?.().kind === 'edge');
    expect(lines.map((edge) => edge.id)).toEqual(scene.drawn.edges.map((drawn) => drawn.id));
    for (const [i, drawn] of scene.drawn.edges.entries()) {
      const edge = lines[i];
      expect(edge).toMatchObject({
        source: drawn.edge.from,
        target: drawn.edge.to,
        type: 'template',
      });
      expect(edge.data?.()).toEqual({ kind: 'edge', edge: drawn });
      expect(layoutOf(edge).path).toBe(drawn.path);
      if (drawn.label) {
        expect(layoutOf(edge).labelPoints?.center).toEqual(drawn.label.at);
        expect(edge.edgeLabels?.()).toEqual({
          center: { type: 'html-template', data: drawn.label.text },
        });
      } else {
        expect(edge.edgeLabels).toBeUndefined();
      }
    }
  });

  it('draws each note’s leader as an extra edge from the note, as the kit draws it', () => {
    const leaders = edges.filter((edge) => edge.data?.().kind === 'leader');
    const expected = [...scene.notes].filter(([, placement]) => placement.leader !== null);
    expect(leaders.map((edge) => edge.id)).toEqual(expected.map(([id]) => `leader:${id}`));
    for (const [i, [id, { leader }]] of expected.entries()) {
      const [from, to] = leader!;
      expect(leaders[i].source).toBe(`note:${id}`);
      expect(leaders[i].data?.()).toEqual({ kind: 'leader', from, to });
      expect(layoutOf(leaders[i]).path).toBe(`M ${from.x} ${from.y} L ${to.x} ${to.y}`);
    }
  });
});
