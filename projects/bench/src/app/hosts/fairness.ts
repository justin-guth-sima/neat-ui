import type { DiagramTransform } from '@bench/diagram-seam';
import type { Box } from '../run/gesture-player';
import { NOTE_BOX } from './bench-note';
import { startMatches } from './bench-host';

/*
 * The fairness check between the kit and vflow (design 3.2, "a fairness check"): both draw the
 * kit's scene, so at the same transform every block, frame and note must sit in the same place
 * and every edge on the same path, the kit's notes must measure the box the other host places
 * them at, and the drawn parts must be as many. `fingerprintOf` reads one host's page, in the
 * page; `compareFingerprints` judges two of them, where the harness likes (it calls both through
 * `window.benchFairness` and `window.benchCompare`, `bench-globals.ts`). Boxes are in diagram
 * units, so two hosts a pixel apart on screen still compare; a pair of transforms further apart
 * than the harness's bound (1 % in scale, 2 px) is a problem of its own. Element counts are
 * recorded for the results, not judged: more DOM on one side is what the bench measures.
 */

export interface UnitRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface HostFingerprint {
  readonly host: 'kit' | 'vflow' | 'none';
  readonly transform: DiagramTransform;
  /** `node:<id>` for a frame or block, `note:<id>` for a note, as drawn, in diagram units. */
  readonly boxes: Readonly<Record<string, UnitRect>>;
  /** Each edge's line path (`d`), by edge id. */
  readonly edges: Readonly<Record<string, string>>;
  /** Every element of the page, for the results. */
  readonly dom: number;
}

export interface FairnessReport {
  readonly ok: boolean;
  readonly problems: readonly string[];
  /** Each host's element count. */
  readonly dom: { readonly kit: number; readonly vflow: number };
  /** Frames, blocks, notes and edges drawn by each host. */
  readonly drawn: { readonly kit: DrawnCounts; readonly vflow: DrawnCounts };
}

export interface DrawnCounts {
  readonly nodes: number;
  readonly notes: number;
  readonly edges: number;
}

/** Diagram units a box may differ by: a 1 px border drawn inside, layout rounding. */
const BOX_TOLERANCE = 1;
/** The kit's measured note against the box the other hosts place theirs at. */
const NOTE_TOLERANCE = 0.5;

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Reads `root` as the host `host` draws it, at `transform`, with `box` the zoom box on the page.
 * The synthetic diagram has frames and blocks only (`.frame`, `.block`), and notes (`.note`); the
 * kit repeats a note's id on its leader and an edge's on its label, which are not boxes.
 */
export function fingerprintOf(
  root: ParentNode,
  host: HostFingerprint['host'],
  box: Box,
  transform: DiagramTransform,
): HostFingerprint {
  const unit = (element: Element): UnitRect => {
    const r = element.getBoundingClientRect();
    return {
      x: round((r.left - box.left - transform.x) / transform.k),
      y: round((r.top - box.top - transform.y) / transform.k),
      w: round(r.width / transform.k),
      h: round(r.height / transform.k),
    };
  };
  const boxes: Record<string, UnitRect> = {};
  for (const element of root.querySelectorAll('.frame[data-node], .block[data-node]')) {
    boxes[`node:${element.getAttribute('data-node')}`] = unit(element);
  }
  for (const element of root.querySelectorAll('.note[data-note]')) {
    boxes[`note:${element.getAttribute('data-note')}`] = unit(element);
  }
  const edges: Record<string, string> = {};
  for (const group of root.querySelectorAll('g.edge[data-edge]')) {
    edges[group.getAttribute('data-edge') ?? ''] =
      group.querySelector('path.line')?.getAttribute('d') ?? '';
  }
  return { host, transform, boxes, edges, dom: root.querySelectorAll('*').length };
}

const counts = (fingerprint: HostFingerprint): DrawnCounts => ({
  nodes: Object.keys(fingerprint.boxes).filter((id) => id.startsWith('node:')).length,
  notes: Object.keys(fingerprint.boxes).filter((id) => id.startsWith('note:')).length,
  edges: Object.keys(fingerprint.edges).length,
});

const show = (r: UnitRect): string => `x ${r.x}, y ${r.y}, ${r.w} × ${r.h}`;

/** The kit's fingerprint against vflow's, in that order. */
export function compareFingerprints(kit: HostFingerprint, vflow: HostFingerprint): FairnessReport {
  if (kit.host !== 'kit' || vflow.host !== 'vflow') {
    throw new Error(
      `compare a kit fingerprint with a vflow one, not ${kit.host} and ${vflow.host}`,
    );
  }
  const problems: string[] = [];

  if (!startMatches(vflow.transform, kit.transform)) {
    problems.push(
      `the transforms differ by more than 1 % or 2 px: kit k ${kit.transform.k}, ` +
        `x ${kit.transform.x}, y ${kit.transform.y}; vflow k ${vflow.transform.k}, ` +
        `x ${vflow.transform.x}, y ${vflow.transform.y}`,
    );
  }

  for (const id of new Set([...Object.keys(kit.boxes), ...Object.keys(vflow.boxes)])) {
    const a = kit.boxes[id];
    const b = vflow.boxes[id];
    if (!a || !b) {
      problems.push(`${id} is missing from ${a ? 'vflow' : 'kit'}`);
    } else if (
      Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h)) >
      BOX_TOLERANCE
    ) {
      problems.push(`${id} differs: kit ${show(a)}; vflow ${show(b)}`);
    }
  }

  for (const id of new Set([...Object.keys(kit.edges), ...Object.keys(vflow.edges)])) {
    const a = kit.edges[id];
    const b = vflow.edges[id];
    if (a === undefined || b === undefined) {
      problems.push(`edge ${id} is missing from ${a === undefined ? 'kit' : 'vflow'}`);
    } else if (a !== b) {
      problems.push(`edge ${id} is on another path: kit ${a}; vflow ${b}`);
    }
  }

  for (const fingerprint of [kit, vflow]) {
    for (const [id, r] of Object.entries(fingerprint.boxes)) {
      if (!id.startsWith('note:')) continue;
      if (
        Math.abs(r.w - NOTE_BOX.w) > NOTE_TOLERANCE ||
        Math.abs(r.h - NOTE_BOX.h) > NOTE_TOLERANCE
      ) {
        problems.push(
          `note ${id.slice(5)} measures ${r.w} × ${r.h} in ${fingerprint.host}; ` +
            `the note box is ${NOTE_BOX.w} × ${NOTE_BOX.h}`,
        );
      }
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    dom: { kit: kit.dom, vflow: vflow.dom },
    drawn: { kit: counts(kit), vflow: counts(vflow) },
  };
}
