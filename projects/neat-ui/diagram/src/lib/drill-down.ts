import type { NeatDiagram, NeatDiagramNode } from './model';
import { reportLeftOut } from './report';

/*
 * The Autoware demo's drill-down placement on the generic model: a level placed from the diagram a
 * block sits in, for an app that does not place the level by hand.
 */

// The demo's sizes, which its drill-downs were tested with.

/** Room between the group's border and the nodes inside it, right and below. */
const FRAME_PAD = 40;
/**
 * The nodes outside the block: their size (wide enough for a name on one line), the room between
 * them, and their gap to the group (room for six Z edges' spread middle runs, the demo's six
 * cameras into YOLOX).
 */
const OUTSIDE_W = 300;
const OUTSIDE_H = 64;
const OUTSIDE_SPACING = 24;
const OUTSIDE_GAP = 220;

/**
 * The level a block opens, placed from a diagram that holds the block's insides.
 *
 * ```ts
 * const set = { overview, levels: { detector: neatDrillDownLevel(pipeline, 'detector') } };
 * ```
 *
 * The block becomes the level's group, at the origin, sized to its children with a padding.
 * Everything inside the block, however deep, stays as placed: positions are relative to the
 * parent, so nothing moves.
 *
 * The nodes that the edges from inside reach go in a column left of the group (senders) and right
 * of it (receivers), centered on it vertically. A node that both sends and receives goes in the
 * senders' column only, so it is on the level once. The level holds the edges with an end inside.
 *
 * The outside nodes and the group get their sides afresh, since an overview's `inSide` and
 * `outSide` suit its placement, not this one. The group opens nothing: it is the level. The
 * diagram's notes are left behind, since they are placed for it.
 *
 * A block that is not on the diagram, or holds nothing, gives an empty level, named once.
 */
export function neatDrillDownLevel(diagram: NeatDiagram, blockId: string): NeatDiagram {
  const block = diagram.nodes.find((node) => node.id === blockId);
  const children = diagram.nodes.filter((node) => node.parent === blockId);
  if (!block || children.length === 0) {
    reportLeftOut(
      block
        ? `block "${blockId}" has nothing inside to drill into`
        : `block "${blockId}" to drill into is not on the diagram`,
    );
    return { nodes: [], edges: [] };
  }
  const inside = within(diagram.nodes, blockId);
  const w = Math.max(...children.map((child) => child.x + child.w)) + FRAME_PAD;
  const h = Math.max(...children.map((child) => child.y + child.h)) + FRAME_PAD;
  const group: NeatDiagramNode = { ...placed(block, 0, 0, w, h), role: 'group', opens: undefined };
  const edges = diagram.edges.filter((edge) => inside.has(edge.from) || inside.has(edge.to));
  const senders = new Set(edges.filter((edge) => !inside.has(edge.from)).map((edge) => edge.from));
  const receivers = new Set(
    edges.filter((edge) => !inside.has(edge.to) && !senders.has(edge.to)).map((edge) => edge.to),
  );
  const column = (ids: ReadonlySet<string>, x: number): NeatDiagramNode[] => {
    // No place for the block itself (the far end of an edge between it and what it holds) nor
    // for an id that names no node (the level's layout leaves that edge out and says so).
    const nodes = [...ids].flatMap((id) => {
      const node = diagram.nodes.find((n) => n.id === id);
      return node && id !== blockId ? [node] : [];
    });
    const total = nodes.length * (OUTSIDE_H + OUTSIDE_SPACING) - OUTSIDE_SPACING;
    const top = (group.h - total) / 2;
    return nodes.map((node, i) =>
      placed(node, x, top + i * (OUTSIDE_H + OUTSIDE_SPACING), OUTSIDE_W, OUTSIDE_H),
    );
  };
  return {
    nodes: [
      group,
      ...diagram.nodes.filter((node) => inside.has(node.id)),
      ...column(senders, -OUTSIDE_GAP - OUTSIDE_W),
      ...column(receivers, group.w + OUTSIDE_GAP),
    ],
    edges,
  };
}

/** A node moved to the top level of the new level at `x`, `y`, sized `w` by `h`. */
function placed(
  node: NeatDiagramNode,
  x: number,
  y: number,
  w: number,
  h: number,
): NeatDiagramNode {
  return { ...node, parent: undefined, x, y, w, h, inSide: undefined, outSide: undefined };
}

/**
 * The ids of the nodes inside `blockId`, however deep. A parent loop that does not pass through
 * the block never reaches it, and one that does stops at the block, so neither adds the block.
 */
function within(nodes: readonly NeatDiagramNode[], blockId: string): Set<string> {
  const found = new Set<string>();
  let added = true;
  while (added) {
    added = false;
    for (const node of nodes) {
      const parent = node.parent;
      if (parent === undefined || node.id === blockId || found.has(node.id)) continue;
      if (parent === blockId || found.has(parent)) {
        found.add(node.id);
        added = true;
      }
    }
  }
  return found;
}
