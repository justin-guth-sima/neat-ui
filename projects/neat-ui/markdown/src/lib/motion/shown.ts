import type { Token } from 'marked';

/*
 * The shown prose of a reply: the text of its prose runs, in the order the template prints them.
 * Code blocks, tables, inline code, images, raw HTML and the checkbox glyphs are not part of it;
 * they grow plainly. Offsets into it say which characters a write adds. Internal.
 */

/** A prose run as the template prints it, and where its text sits in the reply's shown prose. */
export interface ShownLeaf {
  readonly token: Token;
  readonly from: number;
  readonly text: string;
}

/** What one write added to the shown prose: the characters `[from, to)`, shown at `at` (ms). */
export interface Arrival {
  readonly from: number;
  readonly to: number;
  readonly at: number;
  /** Counts the arrivals of one text from 0. */
  readonly index: number;
}

/** A letter of a word piece, with the time it arrived, or null for one shown before. */
export interface ShownLetter {
  readonly char: string;
  readonly at: number | null;
}

/** A part of a leaf as the template renders it: an arrival's text, or text shown before. */
export interface ShownPiece {
  /** Offset in the shown prose: the @for track key. */
  readonly start: number;
  readonly text: string;
  /** Null for text shown before (settled, or the start of a word). */
  readonly arrival: Arrival | null;
  /** 'word' grouping only. */
  readonly letters?: readonly ShownLetter[];
}

/** How a leaf's new text is cut: one piece per arrival, or one per word that holds new letters. */
export type PieceGroup = 'token' | 'word';

/** How far apart the letters of one arrival start in a word piece (ms). */
export const LETTER_STEP_MS = 18;

/** The shown prose leaves of `tokens` in template order, starting at offset `from`. */
export function shownLeaves(
  tokens: readonly Token[],
  from: number,
): { leaves: ShownLeaf[]; end: number } {
  const leaves: ShownLeaf[] = [];
  const end = blockLeaves(tokens, from, leaves);
  return { leaves, end };
}

/** Block tokens, as the template's block template prints them. */
function blockLeaves(tokens: readonly Token[], from: number, leaves: ShownLeaf[]): number {
  let offset = from;
  for (const token of tokens) {
    switch (token.type) {
      case 'paragraph':
      case 'heading':
        offset = inlineLeaves(token.tokens ?? [], offset, leaves);
        break;
      case 'text':
        offset = token.tokens
          ? inlineLeaves(token.tokens, offset, leaves)
          : addLeaf(token, offset, leaves);
        break;
      case 'list':
        for (const item of token.items) offset = blockLeaves(item.tokens, offset, leaves);
        break;
      case 'blockquote':
        offset = blockLeaves(token.tokens ?? [], offset, leaves);
        break;
      default:
        // A code block, a table, a rule, a checkbox, raw HTML: no shown prose.
        break;
    }
  }
  return offset;
}

/** Inline tokens, as the template's inline template prints them. */
function inlineLeaves(tokens: readonly Token[], from: number, leaves: ShownLeaf[]): number {
  let offset = from;
  for (const token of tokens) {
    switch (token.type) {
      case 'strong':
      case 'em':
      case 'del':
      case 'link':
        offset = inlineLeaves(token.tokens ?? [], offset, leaves);
        break;
      case 'text':
        offset = token.tokens
          ? inlineLeaves(token.tokens, offset, leaves)
          : addLeaf(token, offset, leaves);
        break;
      case 'escape':
        offset = addLeaf(token, offset, leaves);
        break;
      default:
        // Inline code, a line break, an image, raw HTML: no shown prose.
        break;
    }
  }
  return offset;
}

function addLeaf(token: Token, from: number, leaves: ShownLeaf[]): number {
  const text: string = 'text' in token ? token.text : '';
  if (text.length > 0) leaves.push({ token, from, text });
  return from + text.length;
}

/** When the last letter of an arrival starts, which the word grouping settles by. */
export function lastLetterAt(arrival: Arrival): number {
  return arrival.at + LETTER_STEP_MS * Math.max(0, arrival.to - arrival.from - 1);
}

/** The pieces of a leaf, or null when no arrival touches it. */
export function piecesOf(
  leaf: ShownLeaf,
  arrivals: readonly Arrival[],
  group: PieceGroup,
): readonly ShownPiece[] | null {
  const end = leaf.from + leaf.text.length;
  const touching = arrivals
    .filter((arrival) => arrival.from < end && arrival.to > leaf.from)
    .sort((a, b) => a.from - b.from);
  if (touching.length === 0) return null;
  return group === 'token' ? byArrival(leaf, touching) : byWord(leaf, touching);
}

/** One piece per arrival's overlap with the leaf, and the text between as settled pieces. */
function byArrival(leaf: ShownLeaf, arrivals: readonly Arrival[]): ShownPiece[] {
  const end = leaf.from + leaf.text.length;
  const pieces: ShownPiece[] = [];
  const push = (start: number, stop: number, arrival: Arrival | null) => {
    if (stop <= start) return;
    pieces.push({ start, text: leaf.text.slice(start - leaf.from, stop - leaf.from), arrival });
  };
  let offset = leaf.from;
  for (const arrival of arrivals) {
    const start = Math.max(arrival.from, offset);
    const stop = Math.min(arrival.to, end);
    push(offset, start, null);
    push(start, stop, arrival);
    offset = Math.max(offset, stop);
  }
  push(offset, end, null);
  return pieces;
}

/**
 * One piece per run of non-space characters that holds a letter of an arrival, from the run's
 * start, so a word that began in settled text is one piece; whitespace stays outside the pieces.
 * Letter `i` of an arrival starts `LETTER_STEP_MS × i` after it.
 */
function byWord(leaf: ShownLeaf, arrivals: readonly Arrival[]): ShownPiece[] {
  const { text, from } = leaf;
  const times: (number | null)[] = new Array(text.length).fill(null);
  const owners: (Arrival | null)[] = new Array(text.length).fill(null);
  for (const arrival of arrivals) {
    const stop = Math.min(arrival.to, from + text.length);
    for (let offset = Math.max(arrival.from, from); offset < stop; offset++) {
      times[offset - from] = arrival.at + LETTER_STEP_MS * (offset - arrival.from);
      owners[offset - from] = arrival;
    }
  }
  const pieces: ShownPiece[] = [];
  let plainFrom = 0;
  const pushPlain = (stop: number) => {
    if (stop > plainFrom) {
      pieces.push({ start: from + plainFrom, text: text.slice(plainFrom, stop), arrival: null });
    }
  };
  let i = 0;
  while (i < text.length) {
    if (SPACE.test(text[i])) {
      i++;
      continue;
    }
    let stop = i;
    let owner: Arrival | null = null;
    for (; stop < text.length && !SPACE.test(text[stop]); stop++) owner ??= owners[stop];
    if (owner) {
      pushPlain(i);
      const letters: ShownLetter[] = [];
      for (let k = i; k < stop; k++) letters.push({ char: text[k], at: times[k] });
      pieces.push({ start: from + i, text: text.slice(i, stop), arrival: owner, letters });
      plainFrom = stop;
    }
    i = stop;
  }
  pushPlain(text.length);
  return pieces;
}

const SPACE = /\s/;
