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
 * What a node is in the drawing: `frame` holds other nodes (drawn behind the edges, its title and
 * detail top left), `block` is a card (label, detail, chips), `band` a strip such as a cable or a
 * bus (its label along it), `bracket` spans a row of siblings below them (a curly line and a
 * label).
 */
export type NeatDiagramRole = 'frame' | 'block' | 'band' | 'bracket';

/**
 * How a node is drawn within its role: `accent` is the primary tint (e.g. the main device),
 * `dashed` a group, `ghost` dashed, transparent and quiet (a part that is not running), `muted`
 * filled with `--muted`.
 */
export type NeatDiagramLook = 'default' | 'accent' | 'dashed' | 'ghost' | 'muted';

/** How an edge ends: plain, with an arrowhead, or with a dot. */
export type NeatDiagramTip = 'none' | 'arrow' | 'dot';

/**
 * What dims the rest of a diagram while the pointer or the keyboard is on a part: `none`, nothing;
 * `edges`, an edge's two blocks, its notes and itself stay and the rest dims; `all`, the same for
 * a block and the edges that join it too.
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
 * A short fact on a block, drawn as the kit's status chip in its tone. Where a part runs is said
 * in one convention, so every diagram reads alike: `HW` (the hardware decoder) in `success`,
 * `EV74` in `highlight`, `MLA` in `info` and `A65` in `neutral`.
 */
export interface NeatDiagramChip {
  readonly label: string;
  readonly tone: NeatTone;
}

/**
 * One node of a diagram level: a frame, block, band or bracket (`role`), placed by hand at `x`,
 * `y` with the size `w` by `h`, in diagram units. A node with a `parent` sits inside it and is
 * placed relative to it; a block with `opens` is a button that opens that level. The kit never
 * reads `data`: it is the app's, handed back to the app's templates.
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
  readonly chips?: readonly NeatDiagramChip[];
  /**
   * Whether what the card shows is stale (the node's diagnostics stopped): the whole card, its
   * label, chips and the app's content, takes the look of `[neatStale]`, faded and grey with no
   * transition, and the hidden list says "stale". The app says in words why, in the card's
   * content. Blocks and brackets only.
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
 * A line between two nodes of a level, which the kit routes: its colour is a charts series
 * (`series`), its look `line`, its ends `start` and `end`, with an optional `label` on it. The app
 * does not place it, only names the nodes it joins. The kit never reads `data`: it is the app's.
 */
export interface NeatDiagramEdge {
  readonly id: string;
  /** The node it leaves. */
  readonly from: string;
  /** The node it enters. */
  readonly to: string;
  /** Its colour, the charts' series colour 1 to 8; unset, or on a `ghost` line, muted. */
  readonly series?: number;
  /** Unset: `solid`. */
  readonly line?: NeatDiagramLine;
  /** Its tip at `from`; unset, `none`. */
  readonly start?: NeatDiagramTip;
  /** Its tip at `to`; unset, `arrow`. */
  readonly end?: NeatDiagramTip;
  /** A short label on the edge, at `labelAt`. */
  readonly label?: string;
  /** Where the label sits along the edge, 0 at `from` to 1 at `to`; unset, 0.5. */
  readonly labelAt?: number;
  /**
   * The side of `from` this edge leaves on, over the node's `outSide` for this edge only; unset,
   * the node's `outSide`, else the side facing the other end. The route and the label follow it.
   * An end inside a frame stays on the frame's border nearest the node, as the node's sides do.
   */
  readonly fromSide?: NeatDiagramSide;
  /** The side of `to` this edge enters on, as `fromSide` is for the leaving end (`inSide`). */
  readonly toSide?: NeatDiagramSide;
  /**
   * Where along its side the edge leaves `from`, 0 at the side's start (its top, or its left) to
   * 1 at its end; unset, the kit spreads the side's ports itself. The other ports on the side keep
   * their places, so two edges pinned to one place meet there.
   */
  readonly fromAt?: number;
  /** Where along its side the edge enters `to`, as `fromAt` is for the leaving end. */
  readonly toAt?: number;
  /**
   * The corners the edge runs through between its ports, in order, in the level's coordinates
   * (as the level's top nodes are placed); drawn straight from one to the next with the kit's
   * rounded turns, so corners in line with each other give an axis-parallel route. Unset, the kit
   * routes the edge itself. An edge with `via` is the app's: the kit spreads no corridor or loop
   * for it.
   */
  readonly via?: readonly { readonly x: number; readonly y: number }[];
  /**
   * Where the label sits at its point (`labelAt`): `on` the line (the default, the line passing
   * under it), or beside it, `above`, `below`, `left` or `right`, a small gap away, the line
   * showing past it.
   */
  readonly labelSide?: NeatDiagramLabelSide;
  /** Moves the label further, in diagram units, after `labelSide` has placed it. */
  readonly labelOffset?: { readonly x: number; readonly y: number };
  /** The app's, never read by the kit. */
  readonly data?: unknown;
}

/**
 * A box of the app's content (a template matched by the note's id or `data`), joined by a dotted
 * leader to its anchor: a point along its edges, or a point of its own. A note anchored by
 * `anchor` alone belongs to no edge, so it is never in focus with one: it dims whenever anything
 * is in focus.
 */
export interface NeatDiagramNote {
  readonly id: string;
  /** The edges it is about; the anchor is the mean of their points at `along`. */
  readonly edges?: readonly string[];
  /** Where along its edges the anchor lies, 0 at their start to 1 at their end; unset, 0.5. */
  readonly along?: number;
  /**
   * The anchor as a point instead (a node's side, for a note about the node); without `x`, the
   * edges' mean x, for a leader into the middle of a bundle of parallel edges.
   */
  readonly anchor?: { readonly x?: number; readonly y: number };
  /** The box's centre, per axis; unset, the anchor moved by `dx` and `dy`. */
  readonly x?: number;
  readonly y?: number;
  readonly dx?: number;
  readonly dy?: number;
  /**
   * Where the leader meets the box: its nearest point (unset; level or upright where it can be),
   * or its centre, under the box (`centre`; a slanted leader then meets no rounded corner).
   */
  readonly leaderTo?: 'centre';
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
 * A diagram with its drill-down levels, each placed by hand: a block whose `opens` names a level
 * opens it, and a level may open further levels.
 */
export interface NeatDiagramSet {
  readonly overview: NeatDiagram;
  readonly levels?: Readonly<Record<string, NeatDiagram>>;
}
