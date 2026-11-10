import {
  type DiagramTransform,
  drawLevel,
  type DrawnLevel,
  fitTransform,
  levelExtent,
  type MessagesLevel,
  type NotePlacement,
  placeNotes,
  type Rect,
} from '@bench/diagram-seam';
import type { SynthDiagram } from '../synth/synth-diagram';
import { NOTE_BOX } from './bench-note';

/*
 * What a host other than the kit draws for a synthetic diagram, computed by the kit's own code
 * through the seam, so vflow and the bare dot layer show the kit's picture: the level as drawn
 * (routes, tips, colors), the notes placed at the note box, and the messaging layer's context as
 * `neat-diagram` builds it (diagram.ts, `messagesContext`). Pure; the hosts bind it.
 */

export interface Scene {
  readonly drawn: DrawnLevel;
  /** Each note's box, anchor and leader, by note id. */
  readonly notes: ReadonlyMap<string, NotePlacement>;
  /** The dot layer's level: every drawn edge with its route. */
  readonly level: MessagesLevel;
  /** What the dots pass behind: the blocks, then the notes. */
  readonly covers: readonly Rect[];
  /** Every edge id, the ids the dot layer counts messages for. */
  readonly edgeIds: ReadonlySet<string>;
  /** What a fit frames; null for a level with nothing drawn. */
  readonly extent: Rect | null;
}

/** The overview's key: the synthetic diagram has no drill-down levels. */
const LEVEL_KEY = 'overview';

export function sceneOf(synth: SynthDiagram): Scene {
  const overview = synth.diagram.overview;
  const drawn = drawLevel(overview, new Set());
  const sizes = new Map((overview.notes ?? []).map((note) => [note.id, NOTE_BOX]));
  const notes = placeNotes(overview, drawn.layouts, sizes);
  const boxes = [...notes.values()].map(({ box }) => box);
  return {
    drawn,
    notes,
    level: {
      key: LEVEL_KEY,
      edges: drawn.edges.map(({ id, edge, line, points }) => ({
        id,
        from: edge.from,
        to: edge.to,
        series: edge.series,
        line,
        points,
      })),
    },
    covers: [
      ...drawn.front.filter(({ node }) => node.role === 'block').map(({ rect }) => rect),
      ...boxes,
    ],
    edgeIds: new Set(overview.edges.map((edge) => edge.id)),
    extent: levelExtent(drawn, boxes),
  };
}

/**
 * Where a host starts: the kit's fit of the scene in a box of `box` px, which the kit host reaches
 * by fitting itself (design 2.3, the same start transform). Null without a size or a level.
 */
export function startTransform(
  scene: Scene,
  box: { readonly w: number; readonly h: number },
): DiagramTransform | null {
  return scene.extent && fitTransform(scene.extent, box);
}
