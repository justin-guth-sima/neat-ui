import { ɵseriesToken } from '@sima/neat-ui';
import {
  absoluteRects,
  type Cover,
  type EdgeLayout,
  layoutEdges,
  type Rect,
  SIDE_AXES,
} from './layout';
import type {
  NeatDiagram,
  NeatDiagramEdge,
  NeatDiagramLabelSide,
  NeatDiagramLine,
  NeatDiagramLook,
  NeatDiagramNode,
  NeatDiagramSide,
  NeatDiagramMarker,
} from './model';
import { isGroup } from './model';
import { firstOfEachId, reportLeftOut } from './report';
import { pointAlong, type Point } from './route';

/*
 * A level as the renderer draws it: each node at its place in the level with its look, each edge
 * with its path, color, markers and label. Pure, so what is drawn is decided (and tested) apart from
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

/** An edge's marker: an arrowhead (a closed path) or a dot, at the edge's `start` or `end`. */
export type DrawnMarker =
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
  /** The app's edge, for its tooltip's template and its words. */
  readonly edge: NeatDiagramEdge;
  readonly path: string;
  /** Its route's corners, ends included (`EdgeLayout.points`): what the messages sample. */
  readonly points: readonly Point[];
  /** The CSS color its line and markers take. */
  readonly color: string;
  readonly line: NeatDiagramLine;
  readonly markers: readonly DrawnMarker[];
  /**
   * Its label: the point it stands at (its route's point at `labelAt`, moved `LABEL_GAP` off the
   * line for a side and by `labelOffset`), and which of its edges or its middle is there: the
   * middle for `on`, its bottom edge for `above`, its top for `below`, its right for `left` and
   * its left for `right` (`.edge-label[data-side]`).
   */
  readonly label: {
    readonly text: string;
    readonly at: Point;
    readonly side: NeatDiagramLabelSide;
  } | null;
}

export interface DrawnLevel {
  /** Groups and bands, drawn behind the edges; a group after the groups it sits in. */
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
/** A dot marker's radius (diagram units). */
const DOT_RADIUS = 3;

/**
 * The color of an edge without a series, or with one the palette lacks: its custom property's
 * name, which the messaging layer's dots resolve too, and the same for CSS.
 */
export const MUTED_TOKEN = '--muted-foreground';
const MUTED = `var(${MUTED_TOKEN})`;

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
    .filter(({ node }) => isGroup(node) || node.role === 'band')
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
  const markers = [
    marker(edge.start ?? 'none', 'start', layout.source, layout.sourceSide),
    marker(edge.end ?? 'arrow', 'end', layout.target, layout.targetSide),
  ].filter((t): t is DrawnMarker => t !== null);
  return {
    id: edge.id,
    edge,
    path: layout.path,
    points: layout.points,
    color: lineColor(edge.series, edge.line, `edge "${edge.id}"`),
    line: edge.line ?? 'solid',
    markers,
    label:
      edge.label === undefined
        ? null
        : labelAt(edge.label, pointAlong(layout.points, edge.labelAt ?? 0.5), edge),
  };
}

/** How far a label beside its line stands off it, in diagram units. */
export const LABEL_GAP = 4;

/** The way a label beside its line is moved off it, by side. */
const OFF: Record<NeatDiagramLabelSide, Point> = {
  on: { x: 0, y: 0 },
  above: { x: 0, y: -1 },
  below: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** A label at the point `on` of its route, placed by its edge's `labelSide` and `labelOffset`. */
function labelAt(
  text: string,
  on: Point,
  edge: NeatDiagramEdge,
): { text: string; at: Point; side: NeatDiagramLabelSide } {
  const side = edge.labelSide && edge.labelSide in OFF ? edge.labelSide : 'on';
  const offset = edge.labelOffset;
  const dx = offset && Number.isFinite(offset.x) ? offset.x : 0;
  const dy = offset && Number.isFinite(offset.y) ? offset.y : 0;
  return {
    text,
    side,
    at: { x: on.x + OFF[side].x * LABEL_GAP + dx, y: on.y + OFF[side].y * LABEL_GAP + dy },
  };
}

/** An edge label's corner radius as a share of the cards' (`.edge-label`: `--radius` / 2). */
export const LABEL_CORNER = 0.5;

/**
 * The boxes the dots pass behind for the edge labels, in diagram units: each measured label's
 * border box (`sizes`, by edge id; at its point by its side, as `.edge-label[data-side]` is) with
 * the label's own corner radius, so a dot is hidden exactly where the label is drawn, as the edge's
 * line is under it. A label not measured yet has none.
 */
export function labelCovers(
  edges: readonly DrawnEdge[],
  sizes: ReadonlyMap<string, { readonly w: number; readonly h: number }>,
): Cover[] {
  return edges.flatMap(({ id, label }) => {
    const size = label && sizes.get(id);
    if (!label || !size) return [];
    // Where the point lies in the box, 0 to 1 across and down: the same as the CSS's translate.
    const [fx, fy] = {
      on: [0.5, 0.5],
      above: [0.5, 1],
      below: [0.5, 0],
      left: [1, 0.5],
      right: [0, 0.5],
    }[label.side];
    return [
      {
        x: label.at.x - size.w * fx,
        y: label.at.y - size.h * fy,
        w: size.w,
        h: size.h,
        corner: LABEL_CORNER,
      },
    ];
  });
}

/**
 * The color of a line, an edge's or a legend sample's: its series' token, else the muted color.
 * A ghost is muted whatever its series: it is a part that does not run here, and stays quiet
 * beside the edges that do. `part` names what has the line in the dev-mode message.
 */
export function lineColor(
  series: number | undefined,
  line: NeatDiagramLine | undefined,
  part: string,
): string {
  if (series === undefined || line === 'ghost') return MUTED;
  const index = seriesIndex(series, part);
  return index === null ? MUTED : ɵseriesToken(index);
}

/**
 * The palette index (from 0, as `NeatSeriesSwatch` and the kit's token rule count) of a diagram
 * series (from 1, as an edge's `series`): the one place the diagram converts between the two.
 * Null for a series that is not 1 to 8, which is named once in dev mode and drawn muted.
 */
export function seriesIndex(series: number, part: string): number | null {
  if (Number.isInteger(series) && series >= 1 && series <= 8) return series - 1;
  reportLeftOut(`${part} is drawn in the muted color: its series ${series} is not 1 to 8`);
  return null;
}

/** A drawn part in words, for the list that says the picture without it. */
export interface DescribedPart {
  readonly id: string;
  readonly text: string;
}

/**
 * The level in words: each node by its label, detail and chips ("Decode, H.264, HW"), each edge
 * by its ends and label ("Camera to Decode, image"). Only what is drawn, so the words and the
 * picture say the same.
 */
export function describeLevel(level: DrawnLevel): {
  readonly nodes: readonly DescribedPart[];
  readonly edges: readonly DescribedPart[];
} {
  const drawnNodes = [...level.behind, ...level.front].map(({ node }) => node);
  const labels = new Map(drawnNodes.map((node) => [node.id, node.label]));
  const words = (...parts: (string | undefined)[]) =>
    parts.filter((part) => part !== undefined && part !== '').join(', ');
  return {
    nodes: drawnNodes.map((node) => ({
      id: node.id,
      text: words(
        node.label,
        node.detail,
        ...(node.chips ?? []).map((chip) => chip.label),
        node.stale ? 'stale' : undefined,
      ),
    })),
    edges: level.edges.map(({ id, edge }) => ({
      id,
      text: words(`${labels.get(edge.from)} to ${labels.get(edge.to)}`, edge.label),
    })),
  };
}

const n = (v: number) => Math.round(v * 100) / 100;

/**
 * An edge's marker at its port on `side`: an arrowhead pointing into the node, its point on the
 * port; or a dot against the side, outside it, so the node (drawn over the edges) hides none of
 * it.
 */
function marker(
  kind: NeatDiagramMarker,
  end: 'start' | 'end',
  port: Point,
  side: NeatDiagramSide,
): DrawnMarker | null {
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
