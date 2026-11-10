import { signal } from '@angular/core';
import type { DrawnEdge, NotePlacement } from '@bench/diagram-seam';
import type { NeatDiagram, NeatDiagramNode, NeatDiagramNote } from '@sima/neat-ui/diagram';
import type { Curve, CurveLayout, Edge, Node } from 'ngx-vflow';
import { NOTE_BOX } from './bench-note';
import type { Scene } from './scene';

/*
 * The kit's scene as ngx-vflow's nodes and edges, set up as the Autoware demo used vflow (design
 * 3.2): frames are SVG group templates, blocks and notes HTML templates (in `foreignObject`s), at
 * the kit's ids, positions (relative to their parents, as in the kit's model) and sizes, none
 * draggable. Edges ignore vflow's own geometry: each one's curve is the kit's route, its label at
 * the point the kit centers it on, so the picture is the same to the pixel and only the renderer
 * differs. Each note's leader is one more edge, so the element counts stay close to the kit's.
 * Pure; the vflow host binds what this returns.
 */

/** What a vflow node draws: a frame, a block, or a note on the edge it is about. */
export type VflowPart =
  | { readonly kind: 'frame' | 'block'; readonly node: NeatDiagramNode }
  | { readonly kind: 'note'; readonly note: NeatDiagramNote; readonly edge: string };

type Leader = NonNullable<NotePlacement['leader']>;

/** What a vflow edge draws: one of the kit's edges, or a note's leader. */
export type VflowLine =
  | { readonly kind: 'edge'; readonly edge: DrawnEdge }
  | { readonly kind: 'leader'; readonly from: Leader[0]; readonly to: Leader[1] };

export interface VflowGraph {
  readonly nodes: Node<VflowPart>[];
  readonly edges: Edge<VflowLine>[];
}

/** A note's node, and its leader's edge: vflow has one id space for nodes, the kit has two. */
const noteNode = (id: string) => `note:${id}`;
const leaderEdge = (id: string) => `leader:${id}`;

/** A curve that is always `layout`, whatever vflow's handles say. */
const fixed = (layout: CurveLayout) => signal<Curve>(() => layout);

export function vflowGraph(overview: NeatDiagram, scene: Scene): VflowGraph {
  const placed = (kind: 'frame' | 'block', node: NeatDiagramNode): Node<VflowPart> => ({
    id: node.id,
    type: kind === 'frame' ? 'template-group' : 'html-template',
    point: signal({ x: node.x, y: node.y }),
    parentId: signal(node.parent ?? null),
    width: signal(node.w),
    height: signal(node.h),
    draggable: signal(false),
    data: signal<VflowPart>({ kind, node }),
  });
  // Frames first, a frame after those it sits in (`behind`'s order): vflow needs a node's parent
  // before it.
  const frames = scene.drawn.behind
    .filter(({ node }) => node.role === 'group')
    .map(({ node }) => placed('frame', node));
  const blocks = scene.drawn.front
    .filter(({ node }) => node.role === 'block')
    .map(({ node }) => placed('block', node));

  const notes: Node<VflowPart>[] = [];
  const leaders: Edge<VflowLine>[] = [];
  for (const note of overview.notes ?? []) {
    const placement = scene.notes.get(note.id);
    const edge = scene.drawn.edges.find((drawn) => drawn.id === note.edges?.[0]);
    if (!placement || !edge) continue;
    notes.push({
      id: noteNode(note.id),
      type: 'html-template',
      point: signal({ x: placement.box.x, y: placement.box.y }),
      width: signal(NOTE_BOX.w),
      height: signal(NOTE_BOX.h),
      draggable: signal(false),
      data: signal<VflowPart>({ kind: 'note', note, edge: edge.id }),
    });
    if (placement.leader) {
      const [from, to] = placement.leader;
      leaders.push({
        id: leaderEdge(note.id),
        // vflow draws an edge only between two nodes' handles; the leader's far end is any node.
        source: noteNode(note.id),
        target: edge.edge.to,
        type: 'template',
        curve: fixed({ path: `M ${from.x} ${from.y} L ${to.x} ${to.y}` }),
        data: signal<VflowLine>({ kind: 'leader', from, to }),
      });
    }
  }

  const lines = scene.drawn.edges.map((drawn): Edge<VflowLine> => {
    const label = drawn.label;
    return {
      id: drawn.id,
      source: drawn.edge.from,
      target: drawn.edge.to,
      type: 'template',
      curve: fixed(
        label
          ? { path: drawn.path, labelPoints: { start: label.at, center: label.at, end: label.at } }
          : { path: drawn.path },
      ),
      data: signal<VflowLine>({ kind: 'edge', edge: drawn }),
      ...(label
        ? { edgeLabels: signal({ center: { type: 'html-template', data: label.text } }) }
        : {}),
    };
  });

  return { nodes: [...frames, ...blocks, ...notes], edges: [...lines, ...leaders] };
}
