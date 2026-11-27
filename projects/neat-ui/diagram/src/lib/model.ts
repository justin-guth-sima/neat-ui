import type { NeatTone } from '@sima/neat-ui';

/*
 * A hand-placed diagram as data: the app places every node and the kit routes the edges between
 * them. The model knows no domain (no messages, topics or stages): what a node or an edge stands
 * for is the app's, kept in `data`, which the kit never reads. Coordinates are diagram units, px
 * at zoom 1; a node's `x` and `y` are relative to its `parent`.
 */

/** A side of a node, where edges meet it. */
export type NeatDiagramSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * What a node is in the drawing: `group`, `block`, `band` or `bracket`.
 *
 * - `group` holds other nodes. It is drawn behind the edges, with its title and detail top left.
 * - `block` is a card, with a label, a detail and badges.
 * - `band` is a strip such as a cable or a bus, with its label along it.
 * - `bracket` spans a row of siblings below them, as a curly line and a label.
 *
 * `frame` is the old name of `group`, still drawn as one. It is deprecated: use `group`.
 */
export type NeatDiagramRole = 'group' | 'block' | 'band' | 'bracket' | 'frame';

/**
 * The badges a node shows: its `badges`, else the deprecated `chips` it used to be given. A node
 * given both shows only its `badges`.
 */
export function badgesOf(node: NeatDiagramNode): readonly NeatDiagramBadge[] {
  return node.badges ?? node.chips ?? [];
}

/** Whether `node` is a group: `role: 'group'`, or the deprecated `'frame'` it used to be called. */
export function isGroup(node: { readonly role: NeatDiagramRole } | undefined): boolean {
  return node?.role === 'group' || node?.role === 'frame';
}

/**
 * How a node is drawn within its role: `default`, `accent`, `dashed`, `ghost` or `muted`.
 *
 * - `accent` is the primary tint, such as for the main device.
 * - `dashed` is a dashed group.
 * - `ghost` is dashed, transparent and quiet, for a part that is not running.
 * - `muted` is filled with `--muted`.
 */
export type NeatDiagramLook = 'default' | 'accent' | 'dashed' | 'ghost' | 'muted';

/** How an edge ends: plain, with an arrowhead, or with a dot. */
export type NeatDiagramMarker = 'none' | 'arrow' | 'dot';

/**
 * The old name of `NeatDiagramMarker`, kept so apps that use it keep working.
 *
 * @deprecated Use `NeatDiagramMarker`; this name goes in a later release.
 */
export type NeatDiagramTip = NeatDiagramMarker;

/**
 * What dims the rest of a diagram while the pointer or the keyboard is on a part.
 *
 * - `none` dims nothing.
 * - `edges`: an edge, its two blocks and its notes stay, and the rest dims.
 * - `all`: the same, and for a block too, with the edges that join it.
 */
export type NeatDiagramHighlight = 'none' | 'edges' | 'all';

/** Where an edge's label sits at its point: on the line, or beside it. */
export type NeatDiagramLabelSide = 'on' | 'above' | 'below' | 'left' | 'right';

/** A part of a diagram as `hovered` and `activated` name it: a block or an edge, by its id. */
export interface NeatDiagramPart {
  readonly kind: 'block' | 'edge';
  readonly id: string;
}

/** A click on a part of a diagram: which part, and the click itself, for its modifier keys. */
export interface NeatDiagramPick extends NeatDiagramPart {
  readonly event: MouseEvent;
}

/** How an edge's line is drawn. */
export type NeatDiagramLine = 'solid' | 'dashed' | 'ghost';

/**
 * A short fact on a block, drawn as the kit's badge (`neat-badge`) in its tone, soft.
 *
 * Where a part runs is said in one convention, so every diagram reads alike:
 * - `HW`, the hardware decoder, in `success`;
 * - `EV74` in `highlight`;
 * - `MLA` in `info`;
 * - `A65` in `neutral`.
 */
export interface NeatDiagramBadge {
  readonly label: string;
  readonly tone: NeatTone;
}

/**
 * The old name of `NeatDiagramBadge`, kept so apps that use it keep working.
 *
 * @deprecated Use `NeatDiagramBadge`; this name goes in a later release.
 */
export type NeatDiagramChip = NeatDiagramBadge;

/**
 * One node of a diagram level: a group, block, band or bracket, as its `role` says.
 *
 * It is placed by hand at `x`, `y`, with the size `w` by `h`, in diagram units. A node with a
 * `parent` sits inside it, and is placed relative to it. A block with `opens` is a button that
 * opens that level. The kit never reads `data`: it is the app's, handed back to the app's
 * templates.
 */
export interface NeatDiagramNode {
  readonly id: string;
  readonly label: string;
  /** A second line: what it is or where it runs. */
  readonly detail?: string;
  /** The node it sits in; `x` and `y` are relative to it. */
  readonly parent?: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly role: NeatDiagramRole;
  /** Unset: `default`. */
  readonly look?: NeatDiagramLook;
  /** Short facts on a block, such as where it runs, drawn as soft badges after its content. */
  readonly badges?: readonly NeatDiagramBadge[];
  /**
   * The old name of `badges`, drawn as they are while the node has no `badges`; a node given both
   * shows only its `badges`.
   *
   * @deprecated Use `badges`; this name goes in a later release.
   */
  readonly chips?: readonly NeatDiagramBadge[];
  /**
   * Whether what the card shows is stale, because the node's diagnostics stopped, say.
   *
   * The whole card, with its label, badges and the app's content, takes the look of `[neatStale]`:
   * faded and gray, with no transition. The hidden list says "stale". The app says in words why, in
   * the card's content. Blocks and brackets only.
   */
  readonly stale?: boolean;
  /** The id of the level (`NeatDiagramSet.levels`) this block opens. */
  readonly opens?: string;
  /**
   * The side its incoming (`inSide`) or outgoing (`outSide`) edges meet it on; unset, each edge
   * end goes on the side that faces the other end.
   */
  readonly inSide?: NeatDiagramSide;
  readonly outSide?: NeatDiagramSide;
  /** The app's, never read by the kit. */
  readonly data?: unknown;
}

/**
 * A line between two nodes of a level, which the kit routes.
 *
 * The app does not place it, and only names the nodes it joins. Its color is a charts series
 * (`series`), its look `line`, and its ends `start` and `end`. It has an optional `label` on it.
 * The kit never reads `data`: it is the app's.
 */
export interface NeatDiagramEdge {
  readonly id: string;
  /** The node it leaves. */
  readonly from: string;
  /** The node it enters. */
  readonly to: string;
  /** Its color, the charts' series color 1 to 8; unset, or on a `ghost` line, muted. */
  readonly series?: number;
  /** Unset: `solid`. */
  readonly line?: NeatDiagramLine;
  /** Its marker at `from`; unset, `none`. */
  readonly start?: NeatDiagramMarker;
  /** Its marker at `to`; unset, `arrow`. */
  readonly end?: NeatDiagramMarker;
  /** A short label on the edge, at `labelAt`. */
  readonly label?: string;
  /** Where the label sits along the edge, 0 at `from` to 1 at `to`; unset, 0.5. */
  readonly labelAt?: number;
  /**
   * The side of `from` this edge leaves on, over the node's `outSide`, for this edge only.
   *
   * Unset, it is the node's `outSide`, else the side facing the other end. The route and the label
   * follow it. An end inside a group stays on the group's border nearest the node, as the node's
   * sides do.
   */
  readonly fromSide?: NeatDiagramSide;
  /** The side of `to` this edge enters on, as `fromSide` is for the leaving end (`inSide`). */
  readonly toSide?: NeatDiagramSide;
  /**
   * Where along its side the edge leaves `from`: 0 at the side's start, its top or left, to 1 at
   * its end.
   *
   * Unset, the kit spreads the side's ports itself. The other ports on the side keep their places,
   * so two edges pinned to one place meet there.
   */
  readonly fromAt?: number;
  /** Where along its side the edge enters `to`, as `fromAt` is for the leaving end. */
  readonly toAt?: number;
  /**
   * The corners the edge runs through between its ports, in order.
   *
   * They are in the level's coordinates, as the level's top nodes are placed. The edge is drawn
   * straight from one to the next, with the kit's rounded turns. So corners in line with each other
   * give an axis-parallel route.
   *
   * Unset, the kit routes the edge itself. An edge with `via` is the app's: the kit spreads no
   * corridor or loop for it.
   */
  readonly via?: readonly { readonly x: number; readonly y: number }[];
  /**
   * Where the label sits at its point (`labelAt`): `on` the line, or beside it.
   *
   * `on`, the default, has the line passing under the label. `above`, `below`, `left` and `right`
   * place it a small gap away, with the line showing past it.
   */
  readonly labelSide?: NeatDiagramLabelSide;
  /** Moves the label further, in diagram units, after `labelSide` has placed it. */
  readonly labelOffset?: { readonly x: number; readonly y: number };
  /** The app's, never read by the kit. */
  readonly data?: unknown;
}

/**
 * A box of the app's content, joined by a dotted leader to its anchor.
 *
 * Its content is a template, matched by the note's id or `data`. Its anchor is a point along its
 * edges, or a point of its own.
 *
 * A note anchored by `anchor` alone belongs to no edge, so it is never in focus with one. It dims
 * whenever anything is in focus.
 */
export interface NeatDiagramNote {
  readonly id: string;
  /** The edges it is about; the anchor is the mean of their points at `along`. */
  readonly edges?: readonly string[];
  /** Where along its edges the anchor lies, 0 at their start to 1 at their end; unset, 0.5. */
  readonly along?: number;
  /**
   * The anchor as a point instead, such as a node's side, for a note about the node.
   *
   * Without `x`, it takes the edges' mean x, for a leader into the middle of a bundle of parallel
   * edges.
   */
  readonly anchor?: { readonly x?: number; readonly y: number };
  /** The box's center, per axis; unset, the anchor moved by `dx` and `dy`. */
  readonly x?: number;
  readonly y?: number;
  readonly dx?: number;
  readonly dy?: number;
  /**
   * Where the leader meets the box: its nearest point, or its center.
   *
   * Unset, it meets the box's nearest point, level or upright where it can be. With `center`, it
   * meets the center, under the box, so a slanted leader meets no rounded corner.
   */
  readonly leaderTo?: 'center';
  /** The app's, never read by the kit. */
  readonly data?: unknown;
}

/** One level: nodes, the edges between them and the notes on them. */
export interface NeatDiagram {
  readonly nodes: readonly NeatDiagramNode[];
  readonly edges: readonly NeatDiagramEdge[];
  readonly notes?: readonly NeatDiagramNote[];
}

/**
 * A diagram with its drill-down levels, each placed by hand.
 *
 * A block whose `opens` names a level opens it, and a level may open further levels.
 */
export interface NeatDiagramSet {
  readonly overview: NeatDiagram;
  readonly levels?: Readonly<Record<string, NeatDiagram>>;
}
