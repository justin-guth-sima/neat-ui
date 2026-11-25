import type { Token } from 'marked';
import type { MarkdownBlock } from '../blocks';
import {
  type Arrival,
  lastLetterAt,
  type PieceGroup,
  piecesOf,
  type ShownLeaf,
  type ShownPiece,
  shownLeaves,
} from './shown';

/**
 * Which characters of a streamed reply's shown prose each write adds, and how they are cut into
 * pieces for the template. Internal to `neat-markdown`.
 *
 * Let `p` be the common prefix of the live blocks' shown text before and after a write, and `n`
 * the new length. The write's arrival is `[max(p, n − grown), n)`: text that changed without
 * growing (a table or a setext heading resolving) shows plain, and earlier arrivals are cut at
 * `p`. The finished blocks' shown ends are kept per block, so a write walks only the live blocks
 * (and the finished ones an unsettled arrival still reaches), never the whole reply.
 */
export class TextArrivals {
  private arrivals: Arrival[] = [];
  private count = 0;
  private resets = 0;
  /** Where each finished block's shown prose ends. */
  private readonly ends = new WeakMap<MarkdownBlock, number>();
  /** The previous write's live blocks: the index of the first, its offset, their shown text. */
  private liveIndex = 0;
  private liveStart = 0;
  private liveText = '';
  /** The finished block before them, to know the next write continues these blocks. */
  private lastFinished: MarkdownBlock | null = null;

  constructor(private readonly leavesOf: typeof shownLeaves = shownLeaves) {}

  /** Notes what the render adds. `grown`: source characters added since the last update. */
  update(
    blocks: readonly MarkdownBlock[],
    grown: number,
    now: number,
    settleMs: number,
    group: PieceGroup,
  ): ReadonlyMap<Token, readonly ShownPiece[]> {
    let index = this.liveIndex;
    let offset = this.liveStart;
    if (index > blocks.length || (index > 0 && blocks[index - 1] !== this.lastFinished)) {
      // Not the blocks the last write showed: compare against nothing.
      index = 0;
      offset = 0;
      this.liveText = '';
    }
    const start = offset;
    const walked: ShownLeaf[] = [];
    let text = '';
    let liveIndex = blocks.length;
    let liveStart = 0;
    for (let i = index; i < blocks.length; i++) {
      const block = blocks[i];
      const { leaves, end } = this.leavesOf([block.token], offset);
      for (const leaf of leaves) {
        walked.push(leaf);
        text += leaf.text;
      }
      if (block.final && liveIndex === blocks.length) {
        this.ends.set(block, end);
      } else if (liveIndex === blocks.length) {
        liveIndex = i;
        liveStart = offset;
      }
      offset = end;
    }
    if (liveIndex === blocks.length) liveStart = offset;

    const n = offset;
    const p = start + commonPrefix(this.liveText, text);
    this.arrivals = this.arrivals
      .filter((arrival) => arrival.from < p)
      .map((arrival) => (arrival.to > p ? { ...arrival, to: p } : arrival));
    const from = Math.max(p, n - grown);
    if (from < n) this.arrivals.push({ from, to: n, at: now, index: this.count++ });
    this.arrivals = this.arrivals.filter(
      (arrival) => now - (group === 'word' ? lastLetterAt(arrival) : arrival.at) <= settleMs,
    );

    this.liveIndex = liveIndex;
    this.liveStart = liveStart;
    this.liveText = text.slice(liveStart - start);
    this.lastFinished = liveIndex > 0 ? blocks[liveIndex - 1] : null;

    const pieces = new Map<Token, readonly ShownPiece[]>();
    if (this.arrivals.length === 0) return pieces;
    for (const leaf of [...this.reachedFinished(blocks, index, start), ...walked]) {
      const cut = piecesOf(leaf, this.arrivals, group);
      if (cut) pieces.set(leaf.token, cut);
    }
    return pieces;
  }

  /** Counts the resets: the pieces' indices start from 0 again in each epoch. */
  get epoch(): number {
    return this.resets;
  }

  /** Forgets every arrival and the blocks they were in; the next write is the first. */
  reset(): void {
    this.resets++;
    this.arrivals = [];
    this.count = 0;
    this.liveIndex = 0;
    this.liveStart = 0;
    this.liveText = '';
    this.lastFinished = null;
  }

  /** The leaves of the finished blocks before `index` that an unsettled arrival still reaches. */
  private reachedFinished(
    blocks: readonly MarkdownBlock[],
    index: number,
    start: number,
  ): ShownLeaf[] {
    const earliest = Math.min(...this.arrivals.map((arrival) => arrival.from));
    if (earliest >= start) return [];
    const reached: ShownLeaf[][] = [];
    for (let i = index - 1; i >= 0; i--) {
      const end = this.ends.get(blocks[i]);
      if (end === undefined || end <= earliest) break;
      const from = i > 0 ? (this.ends.get(blocks[i - 1]) ?? 0) : 0;
      reached.unshift(this.leavesOf([blocks[i].token], from).leaves);
    }
    return reached.flat();
  }
}

function commonPrefix(a: string, b: string): number {
  const most = Math.min(a.length, b.length);
  let i = 0;
  while (i < most && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}
