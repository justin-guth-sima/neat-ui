import type {
  NeatDiagramChip,
  NeatDiagramEdge,
  NeatDiagramNode,
  NeatDiagramNote,
  NeatDiagramSet,
} from '@sima/neat-ui/diagram';
import { mulberry32, type Prng, randomInt, shuffled } from './prng';

/*
 * The bench's synthetic diagram (design 2.1): a hand-placed diagram of any size, the same for a
 * seed on every machine, since the kit has no automatic layout to place one. Frames sit in a
 * near-square grid, their blocks in rows, at the showcase's block sizes. The counts are asked for
 * directly, not as ratios, so the ladders' base D1 is exactly the demo's size and a step scales it
 * by multiplying its counts. Only integer arithmetic and IEEE-exact operations shape it (see
 * prng.ts).
 */

/** What to draw: every count is drawn exactly, or the generator refuses. */
export interface SynthParams {
  /** At least two: the grid's first cell stays empty as the free spot. */
  readonly frames: number;
  /** Spread over the frames as evenly as they go, the first frames taking one more. */
  readonly blocks: number;
  readonly edges: number;
  /** Blocks that send to `fanOut` blocks each, in their frame or a neighbouring one. */
  readonly fanOuts: number;
  readonly fanOut: number;
  /** Edges that carry a label. */
  readonly labels: number;
  /** Notes, each on a message-carrying edge; edges take several when there are more notes. */
  readonly notes: number;
}

/** Why an edge exists, in its `data`, for the specs and for reading a generated diagram. */
export type SynthEdgeKind = 'fan-out' | 'cross' | 'chain' | 'skip';

export interface SynthDiagram {
  readonly diagram: NeatDiagramSet;
  /** The edges the message feed puts dots on: all but the ghost lines, which do not run. */
  readonly messageEdges: readonly string[];
  /**
   * A point in diagram units that no node covers, a frame's size from every frame: where the
   * gesture player presses to pan, so no node takes the press.
   */
  readonly freeSpot: { readonly x: number; readonly y: number };
}

/**
 * The ladders' base, the Autoware overview's size: 4 frames, 30 blocks, 36 edges of which 6
 * fan-outs of 3, 12 edge labels and 8 notes.
 */
export const D1: SynthParams = {
  frames: 4,
  blocks: 30,
  edges: 36,
  fanOuts: 6,
  fanOut: 3,
  labels: 12,
  notes: 8,
};

/** `params` scaled by `s` (rounded): a fan-out's width is a shape, not a size, so it stays. */
export function scaledParams(params: SynthParams, s: number): SynthParams {
  const scale = (count: number): number => Math.round(count * s);
  return {
    frames: scale(params.frames),
    blocks: scale(params.blocks),
    edges: scale(params.edges),
    fanOuts: scale(params.fanOuts),
    fanOut: params.fanOut,
    labels: scale(params.labels),
    notes: scale(params.notes),
  };
}

// The showcase's block, wide enough for a label beside three chips, and taller with a detail.
const BLOCK_W = 230;
const BLOCK_H = 46;
const BLOCK_DETAIL_H = 58;
// Inside a frame: its title above the blocks, and room between them for the edges' corridors.
const FRAME_PAD = 24;
const FRAME_TITLE = 48;
const COLUMN_GAP = 80;
const ROW_GAP = 32;
/** Between frames: room for cross-frame corridors and the notes on their edges. */
const FRAME_GAP = 200;
/** A note's distance from its edge, and how much further each pair sharing an edge stacks. */
const NOTE_OFFSET = 48;
const NOTE_STACK = 72;
/** Every this many edges, one is dashed, and one is a ghost (which wins where both fall). */
const DASHED_EVERY = 12;
const GHOST_EVERY = 18;

/** The kit's chips for where a part runs (AGENTS.md "How the diagram is drawn"). */
const CHIPS: readonly NeatDiagramChip[] = [
  { label: 'HW', tone: 'success' },
  { label: 'EV74', tone: 'highlight' },
  { label: 'MLA', tone: 'info' },
  { label: 'A65', tone: 'neutral' },
];

/** The smallest integer whose square reaches `n`, without `Math.sqrt`'s floating point. */
function ceilSqrt(n: number): number {
  let root = 0;
  while (root * root < n) root++;
  return root;
}

function validate(params: SynthParams): void {
  for (const [name, count] of Object.entries(params)) {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`${name} is a count, not ${count}`);
    }
  }
  const { frames, blocks, edges, fanOuts, fanOut, labels } = params;
  const refuse = (why: string): never => {
    throw new RangeError(why);
  };
  if (frames < 2) refuse(`${frames} frame(s): the free spot takes a grid cell beside a second`);
  if (blocks < frames) refuse(`${blocks} blocks cannot fill ${frames} frames`);
  if (fanOuts > blocks) refuse(`${fanOuts} fan-outs need as many of the ${blocks} blocks`);
  if (fanOuts > 0 && (fanOut < 1 || fanOut > blocks - 1)) {
    refuse(`a fan-out of ${fanOut} needs as many blocks besides its own, of ${blocks}`);
  }
  if (edges < fanOuts * fanOut) refuse(`${edges} edges are fewer than the fan-outs draw`);
  if (labels > edges) refuse(`${labels} labels need as many of the ${edges} edges`);
}

/** The diagram `params` asks for, the same for a `seed` on every machine. */
export function synthDiagram(params: SynthParams, seed: number): SynthDiagram {
  validate(params);
  const rand = mulberry32(seed);

  // The frames: all one size, the size of the fullest, in a grid whose first cell stays free.
  const fullest = Math.ceil(params.blocks / params.frames);
  const columns = ceilSqrt(fullest);
  const rows = Math.ceil(fullest / columns);
  const frameW = 2 * FRAME_PAD + columns * BLOCK_W + (columns - 1) * COLUMN_GAP;
  const frameH = FRAME_TITLE + rows * BLOCK_DETAIL_H + (rows - 1) * ROW_GAP + FRAME_PAD;
  const gridColumns = ceilSqrt(params.frames + 1);
  const cellOf = (frame: number): { column: number; row: number } => ({
    column: (frame + 1) % gridColumns,
    row: Math.floor((frame + 1) / gridColumns),
  });

  const nodes: NeatDiagramNode[] = [];
  /** Each frame's blocks' ids, in row order. */
  const frameBlocks: string[][] = [];
  let n = 0;
  for (let frame = 0; frame < params.frames; frame++) {
    const id = `f${frame}`;
    const { column, row } = cellOf(frame);
    nodes.push({
      id,
      role: 'frame',
      label: `Frame ${frame + 1}`,
      x: column * (frameW + FRAME_GAP),
      y: row * (frameH + FRAME_GAP),
      w: frameW,
      h: frameH,
    });
    const count =
      Math.floor(params.blocks / params.frames) + (frame < params.blocks % params.frames ? 1 : 0);
    const ids: string[] = [];
    for (let i = 0; i < count; i++, n++) {
      const chipCount = randomInt(rand, 0, 3);
      const detail = n % 3 === 0 ? `node ${n}` : undefined;
      ids.push(`${id}b${i}`);
      nodes.push({
        id: `${id}b${i}`,
        role: 'block',
        label: `Block ${n + 1}`,
        ...(detail === undefined ? {} : { detail }),
        parent: id,
        x: FRAME_PAD + (i % columns) * (BLOCK_W + COLUMN_GAP),
        y: FRAME_TITLE + Math.floor(i / columns) * (BLOCK_DETAIL_H + ROW_GAP),
        w: BLOCK_W,
        h: detail === undefined ? BLOCK_H : BLOCK_DETAIL_H,
        ...(chipCount === 0
          ? {}
          : { chips: Array.from({ length: chipCount }, (_, c) => CHIPS[(n + c) % CHIPS.length]) }),
      });
    }
    frameBlocks.push(ids);
  }

  const raw = placeEdges(params, frameBlocks, columns, cellOf, rand);
  const labelled = new Set(
    shuffled(
      rand,
      raw.map((_, i) => i),
    ).slice(0, params.labels),
  );
  const edges: NeatDiagramEdge[] = raw.map(({ from, to, kind }, i) => {
    const ghost = i % GHOST_EVERY === GHOST_EVERY - 1;
    const dashed = !ghost && i % DASHED_EVERY === DASHED_EVERY - 1;
    return {
      id: `e${i}`,
      from,
      to,
      ...(ghost ? { line: 'ghost' as const } : { series: (i % 8) + 1 }),
      ...(dashed ? { line: 'dashed' as const } : {}),
      ...(labelled.has(i) ? { label: `/topic/${i}` } : {}),
      data: { kind },
    };
  });

  const messageEdges = edges.filter((edge) => edge.line !== 'ghost').map((edge) => edge.id);
  if (params.notes > 0 && messageEdges.length === 0) {
    throw new RangeError(`${params.notes} notes need an edge that carries messages`);
  }
  // Every edge gets a note before any gets a second; notes sharing an edge alternate above and
  // below it, each pair further out, so they stack rather than cover one another.
  const noteEdges = shuffled(rand, messageEdges);
  const notes: NeatDiagramNote[] = Array.from({ length: params.notes }, (_, j) => {
    const edge = noteEdges[j % noteEdges.length];
    const round = Math.floor(j / noteEdges.length);
    const distance = NOTE_OFFSET + Math.floor(round / 2) * NOTE_STACK;
    return {
      id: `n${j}`,
      edges: [edge],
      along: 0.5,
      dy: round % 2 === 0 ? -distance : distance,
      data: { edge },
    };
  });

  return {
    diagram: { overview: { nodes, edges, notes } },
    messageEdges,
    freeSpot: { x: frameW / 2, y: frameH / 2 },
  };
}

interface RawEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SynthEdgeKind;
}

/**
 * The edges, in rounds until `params.edges` are placed: the fan-outs first (they are asked for
 * exactly), then one edge per pair of neighbouring frames, then chains inside the frames and then
 * skips over one block, each round a step at a time through every frame so a partial round is
 * spread evenly, and last the neighbouring frames' further pairs. Throws when they run out first.
 */
function placeEdges(
  params: SynthParams,
  frameBlocks: readonly (readonly string[])[],
  columns: number,
  cellOf: (frame: number) => { column: number; row: number },
  rand: Prng,
): RawEdge[] {
  const edges: RawEdge[] = [];
  const pairs = new Set<string>();
  const add = (from: string | undefined, to: string | undefined, kind: SynthEdgeKind): boolean => {
    const key = `${from}>${to}`;
    if (!from || !to || from === to || edges.length === params.edges || pairs.has(key)) {
      return false;
    }
    pairs.add(key);
    edges.push({ from, to, kind });
    return true;
  };

  // Neighbouring frames, the lower index first, with the block pairs that face across their gap:
  // row by row for a frame to the right, column by column for one below.
  const facing: [string, string][][] = [];
  const neighbours = frameBlocks.map((): number[] => []);
  for (let a = 0; a < frameBlocks.length; a++) {
    for (let b = a + 1; b < frameBlocks.length; b++) {
      const ca = cellOf(a);
      const cb = cellOf(b);
      const right = ca.row === cb.row && cb.column === ca.column + 1;
      const below = ca.column === cb.column && cb.row === ca.row + 1;
      if (!right && !below) continue;
      neighbours[a].push(b);
      neighbours[b].push(a);
      const from = frameBlocks[a];
      const to = frameBlocks[b];
      const lines: [string, string][] = [];
      for (let line = 0; line < columns; line++) {
        if (line >= to.length) break;
        if (right && line * columns < from.length) {
          // Row `line`: a's last block in it to b's first.
          lines.push([
            from[Math.min(from.length - 1, line * columns + columns - 1)],
            to[line * columns],
          ]);
        } else if (below && line < from.length) {
          // Column `line`: a's lowest block in it to b's top one.
          lines.push([
            from[line + columns * Math.floor((from.length - 1 - line) / columns)],
            to[line],
          ]);
        }
      }
      facing.push(lines);
    }
  }

  const blocks = frameBlocks.flat();
  const frameOf = new Map(frameBlocks.flatMap((ids, frame) => ids.map((id) => [id, frame])));
  for (const source of shuffled(rand, blocks).slice(0, params.fanOuts)) {
    const frame = frameOf.get(source) as number;
    const near = [frame, ...neighbours[frame]].flatMap((f) => frameBlocks[f]);
    const nearSet = new Set(near);
    const far = blocks.filter((id) => !nearSet.has(id));
    let placed = 0;
    // Validation leaves every source enough other blocks, and no two sources share a pair.
    for (const target of [...shuffled(rand, near), ...shuffled(rand, far)]) {
      if (placed === params.fanOut) break;
      if (add(source, target, 'fan-out')) placed++;
    }
  }

  for (const lines of facing) lines.some(([from, to]) => add(from, to, 'cross'));
  const longest = Math.max(...frameBlocks.map((ids) => ids.length));
  for (const [kind, step] of [
    ['chain', 1],
    ['skip', 2],
  ] as const) {
    for (let i = 0; i + step < longest; i++) {
      for (const ids of frameBlocks) add(ids[i], ids[i + step], kind);
    }
  }
  for (let line = 1; line < columns; line++) {
    for (const lines of facing) add(lines[line]?.[0], lines[line]?.[1], 'cross');
  }

  if (edges.length < params.edges) {
    throw new RangeError(
      `${params.edges} edges do not fit ${params.blocks} blocks in ${params.frames} frames; ` +
        `the generator places at most ${edges.length}`,
    );
  }
  return edges;
}
