import { absoluteRects, type EdgeLayout, layoutEdges, type Rect, SIDE_AXES } from './layout';
import type {
  NeatDiagram,
  NeatDiagramEdge,
  NeatDiagramLine,
  NeatDiagramLook,
  NeatDiagramNode,
  NeatDiagramSide,
  NeatDiagramTip,
} from './model';
import { firstOfEachId, reportLeftOut } from './report';
import { pointAlong, type Point } from './route';

/*
 * A level as the renderer draws it: each node at its place in the level with its look, each edge
 * with its path, colour, tips and label. Pure, so what is drawn is decided (and tested) apart from
 * the DOM; the component's template only binds it.
 */

/** A node as drawn. */
export interface DrawnNode {
  readonly node: NeatDiagramNode;
  /** In the level's coordinates. */
  readonly rect: Rect;
  readonly look: NeatDiagramLook;
  /** A block whose `opens` names a level that exists: it shows the open affordance. */
  readonly opens: boolean;
  /** A bracket's brace, in its own box (`BRACE_HEIGHT` high); null for the other roles. */
  readonly brace: string | null;
}

/** An edge's tip: an arrowhead (a closed path) or a dot, at the edge's `start` or `end`. */
export type DrawnTip =
  | { readonly end: 'start' | 'end'; readonly shape: 'arrow'; readonly d: string }
  | {
      readonly end: 'start' | 'end';
      readonly shape: 'dot';
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
    };

/** An edge as drawn. */
export interface DrawnEdge {
  readonly id: string;
  readonly path: string;
  /** The CSS colour its line and tips take. */
  readonly colour: string;
  readonly line: NeatDiagramLine;
  readonly tips: readonly DrawnTip[];
  /** Its label and the point of the route it is centred on. */
  readonly label: { readonly text: string; readonly at: Point } | null;
}

export interface DrawnLevel {
  /** Frames and bands, drawn behind the edges; a frame after the frames it sits in. */
  readonly behind: readonly DrawnNode[];
  /** Blocks and brackets, drawn in front of the edges. */
  readonly front: readonly DrawnNode[];
  readonly edges: readonly DrawnEdge[];
  /** Each drawn edge's layout, by id, which the notes are placed along. */
  readonly layouts: ReadonlyMap<string, EdgeLayout>;
}

/** How tall a bracket's brace is (diagram units); its label sits below it. */
export const BRACE_HEIGHT = 18;

/** An arrowhead's length along its edge and half its width (diagram units). */
const ARROW_LENGTH = 6;
const ARROW_HALF_WIDTH = 3;
/** A dot tip's radius (diagram units). */
const DOT_RADIUS = 3;

/** An edge without a series, or with one the palette lacks. */
const MUTED = 'var(--muted-foreground)';

/**
 * The level as drawn. `levels` are the ids of the levels that exist, which a block's `opens`
 * must name to show the open affordance. A part the layout cannot place (an id that names
 * nothing) is left out, named once in dev mode, and the rest is drawn.
 */
export function drawLevel(diagram: NeatDiagram, levels: ReadonlySet<string>): DrawnLevel {
  const rects = absoluteRects(diagram);
  const nodes = firstOfEachId(diagram.nodes, 'node').filter((node) => rects.has(node.id));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depth = (node: NeatDiagramNode): number => {
    const parent = node.parent === undefined ? undefined : byId.get(node.parent);
    return parent ? depth(parent) + 1 : 0;
  };
  const drawn = nodes.map((node) => drawNode(node, rects.get(node.id) as Rect, levels));
  const behind = drawn
    .filter(({ node }) => node.role === 'frame' || node.role === 'band')
    .map((part, order) => ({ part, order, depth: depth(part.node) }))
    .sort((a, b) => a.depth - b.depth || a.order - b.order)
    .map(({ part }) => part);
  const front = drawn.filter(({ node }) => node.role === 'block' || node.role === 'bracket');

  const layouts = layoutEdges(diagram);
  const edges = firstOfEachId(diagram.edges, 'edge').flatMap((edge) => {
    const layout = layouts.get(edge.id);
    return layout ? [drawEdge(edge, layout)] : [];
  });
  return { behind, front, edges, layouts };
}

function drawNode(node: NeatDiagramNode, rect: Rect, levels: ReadonlySet<string>): DrawnNode {
  let opens = false;
  if (node.role === 'block' && node.opens !== undefined) {
    opens = levels.has(node.opens);
    if (!opens) {
      reportLeftOut(
        `block "${node.id}" is drawn without its open control: "${node.opens}" is not a level`,
      );
    }
  }
  return {
    node,
    rect,
    look: node.look ?? 'default',
    opens,
    brace: node.role === 'bracket' ? bracePath(rect.w) : null,
  };
}

/**
 * A curly brace opening upward, `w` wide and `BRACE_HEIGHT` high (the demo's): the bracket's line
 * under the siblings it spans, its point in the middle towards its label.
 */
function bracePath(w: number): string {
  const h = BRACE_HEIGHT;
  const r = h / 2 - 1;
  const m = w / 2;
  const mid = h / 2;
  return (
    `M 1 1 Q 1 ${mid} ${1 + r} ${mid} L ${m - r} ${mid} Q ${m} ${mid} ${m} ${h - 1} ` +
    `Q ${m} ${mid} ${m + r} ${mid} L ${w - 1 - r} ${mid} Q ${w - 1} ${mid} ${w - 1} 1`
  );
}

function drawEdge(edge: NeatDiagramEdge, layout: EdgeLayout): DrawnEdge {
  const tips = [
    tip(edge.start ?? 'none', 'start', layout.source, layout.sourceSide),
    tip(edge.end ?? 'arrow', 'end', layout.target, layout.targetSide),
  ].filter((t): t is DrawnTip => t !== null);
  return {
    id: edge.id,
    path: layout.path,
    colour: edgeColour(edge),
    line: edge.line ?? 'solid',
    tips,
    label:
      edge.label === undefined
        ? null
        : { text: edge.label, at: pointAlong(layout.points, edge.labelAt ?? 0.5) },
  };
}

/**
 * The colour of an edge: its series' token (the charts' palette, 1 to 8, so a legend's swatch
 * matches it), else the muted colour. A ghost is muted whatever its series: it is a part that does
 * not run here, and stays quiet beside the edges that do. The one place a series becomes a token.
 */
function edgeColour(edge: NeatDiagramEdge): string {
  const { series } = edge;
  if (series === undefined || edge.line === 'ghost') return MUTED;
  if (Number.isInteger(series) && series >= 1 && series <= 8) return `var(--neat-series-${series})`;
  reportLeftOut(
    `edge "${edge.id}" is drawn in the muted colour: its series ${series} is not 1 to 8`,
  );
  return MUTED;
}

const n = (v: number) => Math.round(v * 100) / 100;

/**
 * An edge's tip at its port on `side`: an arrowhead pointing into the node, its point on the
 * port; or a dot against the side, outside it, so the node (drawn over the edges) hides none of
 * it.
 */
function tip(
  kind: NeatDiagramTip,
  end: 'start' | 'end',
  port: Point,
  side: NeatDiagramSide,
): DrawnTip | null {
  const { t, n: out } = SIDE_AXES[side];
  if (kind === 'dot') {
    return {
      end,
      shape: 'dot',
      cx: n(port.x + out.x * DOT_RADIUS),
      cy: n(port.y + out.y * DOT_RADIUS),
      r: DOT_RADIUS,
    };
  }
  if (kind !== 'arrow') return null;
  const base = { x: port.x + out.x * ARROW_LENGTH, y: port.y + out.y * ARROW_LENGTH };
  const a = { x: base.x + t.x * ARROW_HALF_WIDTH, y: base.y + t.y * ARROW_HALF_WIDTH };
  const b = { x: base.x - t.x * ARROW_HALF_WIDTH, y: base.y - t.y * ARROW_HALF_WIDTH };
  const d = `M ${n(port.x)} ${n(port.y)} L ${n(a.x)} ${n(a.y)} L ${n(b.x)} ${n(b.y)} Z`;
  return { end, shape: 'arrow', d };
}
