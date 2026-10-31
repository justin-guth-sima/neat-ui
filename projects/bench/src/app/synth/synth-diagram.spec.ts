import type { NeatDiagramEdge, NeatDiagramNode } from '@sima/neat-ui/diagram';
import { fingerprint } from './fingerprint.testing';
import {
  D1,
  scaledParams,
  type SynthEdgeKind,
  type SynthParams,
  synthDiagram,
} from './synth-diagram';

const kindOf = (edge: NeatDiagramEdge): SynthEdgeKind =>
  (edge.data as { kind: SynthEdgeKind }).kind;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Where a node sits in diagram units: its own x and y are relative to its parent. */
function absolute(node: NeatDiagramNode, nodes: readonly NeatDiagramNode[]): Box {
  const parent = nodes.find((candidate) => candidate.id === node.parent);
  return {
    x: node.x + (parent?.x ?? 0),
    y: node.y + (parent?.y ?? 0),
    w: node.w,
    h: node.h,
  };
}

describe('synthDiagram', () => {
  it.each([
    ['D1', D1],
    ['D1 × 4', scaledParams(D1, 4)],
    ['a frame per block row', { ...D1, frames: 10, blocks: 23, edges: 25, notes: 40 }],
  ])('draws the counts asked for (%s)', (_, params: SynthParams) => {
    const { diagram } = synthDiagram(params, 1);
    const { nodes, edges, notes = [] } = diagram.overview;

    expect(nodes.filter((node) => node.role === 'frame').length).toBe(params.frames);
    expect(nodes.filter((node) => node.role === 'block').length).toBe(params.blocks);
    expect(edges.length).toBe(params.edges);
    expect(edges.filter((edge) => edge.label !== undefined).length).toBe(params.labels);
    expect(notes.length).toBe(params.notes);
    const fans = new Map<string, number>();
    for (const edge of edges.filter((candidate) => kindOf(candidate) === 'fan-out')) {
      fans.set(edge.from, (fans.get(edge.from) ?? 0) + 1);
    }
    expect(fans.size).toBe(params.fanOuts);
    expect([...fans.values()].every((count) => count === params.fanOut)).toBe(true);
  });

  it('builds D1 from cross-frame edges, chains and fan-outs', () => {
    const kinds = synthDiagram(D1, 1).diagram.overview.edges.map(kindOf);

    expect(kinds.filter((kind) => kind === 'fan-out').length).toBe(18);
    expect(kinds).toContain('cross');
    expect(kinds).toContain('chain');
  });

  it('gives the same diagram for a seed and another for another seed', () => {
    expect(synthDiagram(D1, 7)).toEqual(synthDiagram(D1, 7));
    expect(synthDiagram(D1, 7)).not.toEqual(synthDiagram(D1, 8));
  });

  it('gives the pinned diagram for D1 and seed 1, so runs on any machine and day compare', () => {
    // Changing the generator changes every run's load: re-pin only on purpose, and say so in the
    // commit, since results from before and after no longer compare.
    expect(fingerprint(synthDiagram(D1, 1))).toBe('586c271f');
  });

  it('places the blocks of a frame inside it without overlapping one another', () => {
    const { nodes } = synthDiagram(scaledParams(D1, 2), 3).diagram.overview;
    const frames = nodes.filter((node) => node.role === 'frame');

    for (const frame of frames) {
      const blocks = nodes.filter((node) => node.parent === frame.id);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block.x).toBeGreaterThanOrEqual(0);
        expect(block.y).toBeGreaterThanOrEqual(0);
        expect(block.x + block.w).toBeLessThanOrEqual(frame.w);
        expect(block.y + block.h).toBeLessThanOrEqual(frame.h);
        for (const other of blocks.filter((candidate) => candidate !== block)) {
          expect(overlaps(block, other)).toBe(false);
        }
      }
      for (const other of frames.filter((candidate) => candidate !== frame)) {
        expect(overlaps(frame, other)).toBe(false);
      }
    }
  });

  it('keeps a free spot inside the drawing, a frame’s size away from every node', () => {
    const { diagram, freeSpot } = synthDiagram(D1, 1);
    const { nodes } = diagram.overview;
    const boxes = nodes.map((node) => absolute(node, nodes));
    const frame = nodes.find((node) => node.role === 'frame') as NeatDiagramNode;
    const margin = Math.min(frame.w, frame.h) / 2;

    expect(freeSpot.x).toBeGreaterThan(Math.min(...boxes.map((box) => box.x)));
    expect(freeSpot.y).toBeGreaterThan(Math.min(...boxes.map((box) => box.y)));
    expect(freeSpot.x).toBeLessThan(Math.max(...boxes.map((box) => box.x + box.w)));
    expect(freeSpot.y).toBeLessThan(Math.max(...boxes.map((box) => box.y + box.h)));
    const around = { x: freeSpot.x - margin, y: freeSpot.y - margin, w: 2 * margin, h: 2 * margin };
    for (const box of boxes) expect(overlaps(around, box)).toBe(false);
  });

  it('joins drawn blocks only, each pair once and never a block to itself', () => {
    const { nodes, edges } = synthDiagram(scaledParams(D1, 2), 5).diagram.overview;
    const blocks = new Set(nodes.filter((node) => node.role === 'block').map((node) => node.id));

    for (const edge of edges) {
      expect(blocks.has(edge.from)).toBe(true);
      expect(blocks.has(edge.to)).toBe(true);
      expect(edge.from).not.toBe(edge.to);
    }
    const pairs = edges.map((edge) => `${edge.from}>${edge.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    const ids = [...nodes, ...edges].map((part) => part.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries messages on every edge but the ghosts, and anchors each note to one of them', () => {
    const { diagram, messageEdges } = synthDiagram(D1, 1);
    const { edges, notes = [] } = diagram.overview;

    expect(messageEdges).toEqual(edges.filter((edge) => edge.line !== 'ghost').map((e) => e.id));
    expect(edges.some((edge) => edge.line === 'ghost')).toBe(true);
    expect(edges.some((edge) => edge.line === 'dashed')).toBe(true);
    for (const note of notes) {
      expect(note.edges?.length).toBe(1);
      expect(messageEdges).toContain(note.edges?.[0]);
      expect(note.along).toBe(0.5);
      expect(note.data).toEqual({ edge: note.edges?.[0] });
    }
  });

  it('spreads notes over the edges and stacks the ones that share an edge apart', () => {
    const params = { ...D1, notes: 100 };
    const { diagram, messageEdges } = synthDiagram(params, 1);
    const notes = diagram.overview.notes ?? [];
    const byEdge = new Map<string, number[]>();
    for (const note of notes) {
      const edge = note.edges?.[0] as string;
      byEdge.set(edge, [...(byEdge.get(edge) ?? []), note.dy as number]);
    }

    expect(byEdge.size).toBe(messageEdges.length);
    for (const offsets of byEdge.values()) expect(new Set(offsets).size).toBe(offsets.length);
  });

  it('colours the running edges by series 1 to 8 and gives blocks their chips and details', () => {
    const { nodes, edges } = synthDiagram(D1, 2).diagram.overview;
    const blocks = nodes.filter((node) => node.role === 'block');

    for (const edge of edges.filter((candidate) => candidate.line !== 'ghost')) {
      expect(edge.series).toBeGreaterThanOrEqual(1);
      expect(edge.series).toBeLessThanOrEqual(8);
    }
    expect(new Set(edges.map((edge) => edge.series)).size).toBeGreaterThan(4);
    for (const block of blocks) {
      expect(block.chips?.length ?? 0).toBeLessThanOrEqual(3);
      expect(new Set(block.chips?.map((chip) => chip.label)).size).toBe(block.chips?.length ?? 0);
    }
    expect(new Set(blocks.map((block) => block.chips?.length ?? 0)).size).toBeGreaterThan(2);
    expect(blocks.filter((block) => block.detail !== undefined).length).toBe(10);
  });

  it.each([
    ['fractional counts', { ...D1, blocks: 30.5 }],
    ['negative counts', { ...D1, notes: -1 }],
    ['one frame (the free spot needs a second)', { ...D1, frames: 1 }],
    ['fewer blocks than frames', { ...D1, blocks: 3 }],
    ['more fan-outs than blocks', { ...D1, fanOuts: 31 }],
    ['a fan-out wider than the other blocks', { ...D1, fanOut: 30 }],
    ['fewer edges than the fan-outs draw', { ...D1, edges: 17 }],
    ['more labels than edges', { ...D1, labels: 37 }],
    ['more edges than the generator can place', { ...D1, edges: 1000 }],
  ])('refuses %s', (_, params: SynthParams) => {
    expect(() => synthDiagram(params, 1)).toThrow(RangeError);
  });
});

describe('scaledParams', () => {
  it('scales every count but the fan-out’s width, which is a shape, not a size', () => {
    expect(scaledParams(D1, 2)).toEqual({
      frames: 8,
      blocks: 60,
      edges: 72,
      fanOuts: 12,
      fanOut: 3,
      labels: 24,
      notes: 16,
    });
  });

  it('rounds a refinement step’s fractional scale to whole counts', () => {
    expect(scaledParams(D1, 1.5)).toEqual({
      frames: 6,
      blocks: 45,
      edges: 54,
      fanOuts: 9,
      fanOut: 3,
      labels: 18,
      notes: 12,
    });
  });
});
