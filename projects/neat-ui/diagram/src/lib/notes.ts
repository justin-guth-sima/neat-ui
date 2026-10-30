import type { EdgeLayout, Rect } from './layout';
import type { NeatDiagram, NeatDiagramNote } from './model';
import { firstOfEachId, reportLeftOut } from './report';
import { pointAlong, type Point } from './route';

/*
 * Where a level's notes go, by the Autoware demo's rules for its rate cards (ported from its dot
 * layer), in diagram units. Pure: the renderer measures each note's box once its content is
 * rendered and draws what this returns.
 */

/** A note as drawn: its box, the point it is about, and its leader (none under the box). */
export interface NotePlacement {
  box: Rect;
  anchor: Point;
  /** From the anchor to the box; null while the anchor is under the box. */
  leader: [Point, Point] | null;
}

/**
 * Each note's placement, by id. `edges` are the level's laid-out edges (`layoutEdges`) and
 * `sizes` each note's measured box: a note not measured yet is not placed (the renderer places
 * it once it has its size). A note with nothing to anchor it is left out; an edge it names that
 * is not on its level is ignored, each named once. An edge on the level that the layout left
 * out is ignored quietly: the layout has named it.
 */
export function placeNotes(
  diagram: NeatDiagram,
  edges: ReadonlyMap<string, EdgeLayout>,
  sizes: ReadonlyMap<string, { w: number; h: number }>,
): Map<string, NotePlacement> {
  const edgeIds = new Set(diagram.edges.map((edge) => edge.id));
  const placed = new Map<string, NotePlacement>();
  for (const note of firstOfEachId(diagram.notes ?? [], 'note')) {
    for (const id of note.edges ?? []) {
      if (!edgeIds.has(id)) {
        reportLeftOut(`note "${note.id}" ignores its edge "${id}": it is not on its level`);
      }
    }
    const anchor = anchorOf(note, edges);
    if (!anchor) {
      reportLeftOut(
        `note "${note.id}" is left out: it needs a drawn edge or an anchor with x and y`,
      );
      continue;
    }
    const size = sizes.get(note.id);
    if (size) placed.set(note.id, place(note, anchor, size));
  }
  return placed;
}

/**
 * The point a note is about: its `anchor`, the x it lacks taken from its edges, else the mean of
 * its edges' points at `along`. Null when neither gives a whole point.
 */
function anchorOf(note: NeatDiagramNote, edges: ReadonlyMap<string, EdgeLayout>): Point | null {
  const along = note.along ?? 0.5;
  const points = (note.edges ?? []).flatMap((id) => {
    const edge = edges.get(id);
    return edge ? [pointAlong(edge.points, along)] : [];
  });
  const mean = (axis: 'x' | 'y') =>
    points.length ? points.reduce((sum, p) => sum + p[axis], 0) / points.length : undefined;
  const x = note.anchor?.x ?? mean('x');
  const y = note.anchor ? note.anchor.y : mean('y');
  return x === undefined || y === undefined ? null : { x, y };
}

/**
 * The box centred on `x`/`y` per axis, else on the anchor moved by `dx`/`dy`; the leader to the
 * box's nearest point (level or upright when the anchor is beside, above or below the box, so it
 * reads as pointing straight at it), or to its centre with `leaderTo: 'centre'`, where the box
 * hides its end (a slanted leader then meets no rounded corner).
 */
function place(
  note: NeatDiagramNote,
  anchor: Point,
  size: { w: number; h: number },
): NotePlacement {
  const cx = note.x ?? anchor.x + (note.dx ?? 0);
  const cy = note.y ?? anchor.y + (note.dy ?? 0);
  const box = { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h };
  const clamp = (v: number, low: number, high: number) => Math.min(Math.max(v, low), high);
  const under =
    anchor.x >= box.x &&
    anchor.x <= box.x + box.w &&
    anchor.y >= box.y &&
    anchor.y <= box.y + box.h;
  const end =
    note.leaderTo === 'centre'
      ? { x: cx, y: cy }
      : { x: clamp(anchor.x, box.x, box.x + box.w), y: clamp(anchor.y, box.y, box.y + box.h) };
  return { box, anchor, leader: under ? null : [anchor, end] };
}
