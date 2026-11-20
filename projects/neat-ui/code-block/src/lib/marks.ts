import { isDevMode } from '@angular/core';
import type { CodeLine, CodeRun } from './lines';

/**
 * A mark: lines, or a part of a line, that a code block sets apart while it dims the rest.
 *
 * Lines and columns count from 1, as people read them: line 1 is the first line, as `lineNumbers`
 * numbers it, and column 1 its first character (a tab counts as one). Ranges include both ends.
 *
 * - `{ lines: [4, 6] }` marks lines 4 to 6 and `{ line: 9 }` line 9 alone, each with a band
 *   across the block.
 * - `{ line: 9, text: 'model.run' }` marks the first `model.run` on line 9, with a marker behind
 *   it.
 * - `{ line: 9, from: 12, to: 20 }` marks columns 12 to 20 of line 9, for text that comes more
 *   than once on its line.
 */
export type NeatCodeMark =
  | { readonly lines: readonly [from: number, to: number] }
  | { readonly line: number; readonly text?: string; readonly from?: never; readonly to?: never }
  | { readonly line: number; readonly from: number; readonly to: number; readonly text?: never };

/**
 * One step of a code block's steps: the marks it shows, and a short label that a screen reader
 * hears when the block moves to it.
 *
 * An app adds what it shows beside the block for each step (a note) to its own steps, which
 * the block takes as they are:
 *
 * ```ts
 * interface Step extends NeatCodeStep {
 *   readonly note: string;
 * }
 * ```
 */
export interface NeatCodeStep {
  /** The lines and parts of lines the step marks. A step with none shows the code undimmed. */
  readonly marks: readonly NeatCodeMark[];
  /** What the step is about in a few words ("Open the camera"), said when the block moves to it. */
  readonly label?: string;
}

/** Where a mark falls: a line (from 0) whole, or the columns `[start, end)` of a line (from 0). */
type Spot =
  | { readonly line: number; readonly whole: true }
  | { readonly line: number; readonly whole: false; readonly start: number; readonly end: number };

/** A spot of a mark, and which of its set's marks it is (from 0). */
type Place = Spot & { readonly mark: number };

/**
 * A part mark as a line shows it: whether the shown marks have it, and which of its ends join a
 * neighbor that is on too.
 */
export interface PieceMark {
  readonly on: boolean;
  /** `start`, `end` or `both`: the ends that touch another mark that is on, drawn square. */
  readonly join: 'start' | 'end' | 'both' | null;
  /** Which of the shown marks this is (the first that covers it), from 0; null while it is off. */
  readonly index: number | null;
  /** Whether it is the first element of that mark, which takes the mark's tab stop. */
  readonly first: boolean;
}

/** A stretch of a line: its runs, in a mark of some step or in none (`mark` null). */
export interface CodePiece {
  readonly runs: readonly CodeRun[];
  readonly mark: PieceMark | null;
}

/**
 * A line as a block with marks shows it. `band` is whether the shown marks have the line whole,
 * or null for a line no step has whole. Its pieces are cut at every column any step's marks start
 * or end at, so the elements stay the same from step to step and only their state changes, which
 * lets a mark fade out as the next fades in.
 */
export interface MarkedLine {
  readonly band: boolean | null;
  /** Which of the shown marks has the line whole, from 0, or null. */
  readonly bandIndex: number | null;
  /** Whether the line is the first element of that mark, which takes the mark's tab stop. */
  readonly bandFirst: boolean;
  readonly pieces: readonly CodePiece[];
  readonly end: CodeLine['end'];
}

/** A block's lines with marks, and whether the shown marks have any line or part. */
export interface CodeFocus {
  readonly lines: readonly MarkedLine[];
  readonly marked: boolean;
}

/**
 * What is wrong with `mark` on lines of `texts`, or its places when nothing is. Lines and columns
 * come in from 1 and go out from 0.
 */
function placesOf(mark: NeatCodeMark, texts: readonly string[]): Spot[] | string {
  const isLine = (n: number) => Number.isInteger(n) && n >= 1 && n <= texts.length;
  const named = JSON.stringify(mark);
  const lines = `the code has lines 1 to ${texts.length}`;
  if ('lines' in mark) {
    const [from, to] = mark.lines;
    if (!isLine(from) || !isLine(to) || from > to)
      return `the mark ${named} names no lines: ${lines}`;
    return Array.from({ length: to - from + 1 }, (_, i) => ({ line: from - 1 + i, whole: true }));
  }
  if (!isLine(mark.line)) return `the mark ${named} names no line: ${lines}`;
  const line = mark.line - 1;
  const text = texts[line];
  const columns = mark.from !== undefined || mark.to !== undefined;
  if (mark.text !== undefined && columns) {
    return `the mark ${named} gives both text and columns: give one`;
  }
  if (mark.text !== undefined) {
    const start = mark.text ? text.indexOf(mark.text) : -1;
    if (start < 0)
      return `the mark ${named} names no text on line ${mark.line}: ${JSON.stringify(text)}`;
    return [{ line, whole: false, start, end: start + mark.text.length }];
  }
  if (columns) {
    const { from, to } = mark;
    const isColumn = (n: number | undefined): n is number =>
      n !== undefined && Number.isInteger(n) && n >= 1 && n <= text.length;
    if (!isColumn(from) || !isColumn(to) || from > to) {
      return `the mark ${named} names no columns of line ${mark.line}, which has 1 to ${text.length}`;
    }
    return [{ line, whole: false, start: from - 1, end: to }];
  }
  return [{ line, whole: true }];
}

/**
 * The places of `marks` on lines of `texts`. A mark that names no line or text throws in dev mode
 * (`strict`) and is left out otherwise.
 */
function placesIn(
  marks: readonly NeatCodeMark[],
  texts: readonly string[],
  strict: boolean,
): Place[] {
  return marks.flatMap((mark, index) => {
    const places = placesOf(mark, texts);
    if (typeof places !== 'string') return places.map((place) => ({ ...place, mark: index }));
    if (strict) throw new Error(`neat-code-block: ${places}`);
    return [];
  });
}

/** The runs of `runs` that lie in columns `[start, end)`, cut where they cross its ends. */
function runsBetween(runs: readonly CodeRun[], start: number, end: number): CodeRun[] {
  const cut: CodeRun[] = [];
  let at = 0;
  for (const run of runs) {
    const from = Math.max(start, at);
    const to = Math.min(end, at + run.text.length);
    if (from < to) cut.push({ text: run.text.slice(from - at, to - at), kind: run.kind });
    at += run.text.length;
  }
  return cut;
}

/** The first of a line's part places the column range `[start, end)` lies in. */
const coverOf = (places: readonly Place[], start: number, end: number) =>
  places.find((place) => !place.whole && place.start <= start && place.end >= end);
const covers = (places: readonly Place[], start: number, end: number) =>
  coverOf(places, start, end) !== undefined;

/**
 * One line with the places of each set of marks on it, the shown set's at `shown`. `seen` holds
 * the shown marks that an earlier line has an element of, and gets this line's.
 */
function markLine(
  line: CodeLine,
  sets: readonly (readonly Place[])[],
  shown: number,
  seen: Set<number>,
): MarkedLine {
  const whole = sets.map((places) => places.some((place) => place.whole));
  // A line a set has whole shows none of that set's part marks.
  const parts = sets.map((places, i) => (whole[i] ? [] : places));
  const length = line.runs.reduce((sum, run) => sum + run.text.length, 0);
  const cuts = [
    ...new Set([0, length, ...parts.flat().flatMap((p) => (p.whole ? [] : [p.start, p.end]))]),
  ].sort((a, b) => a - b);

  const pieces: { start: number; end: number; ever: boolean; on: boolean }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [start, end] = [cuts[i], cuts[i + 1]];
    const ever = parts.some((places) => covers(places, start, end));
    pieces.push({ start, end, ever, on: ever && covers(parts[shown], start, end) });
  }
  const isOn = (i: number) => pieces[i]?.on === true;
  /** Whether `index` is a shown mark no earlier element has, which it then has. */
  const firstOf = (index: number | null) => {
    if (index === null || seen.has(index)) return false;
    seen.add(index);
    return true;
  };
  const bandIndex = sets[shown].find((place) => place.whole)?.mark ?? null;
  const bandFirst = firstOf(bandIndex);
  return {
    band: whole.some(Boolean) ? whole[shown] : null,
    bandIndex,
    bandFirst,
    pieces: pieces.map((piece, i) => {
      const runs = runsBetween(line.runs, piece.start, piece.end);
      if (!piece.ever) return { runs, mark: null };
      const [start, end] = [piece.on && isOn(i - 1), piece.on && isOn(i + 1)];
      const join = start && end ? 'both' : start ? 'start' : end ? 'end' : null;
      const index = piece.on ? (coverOf(parts[shown], piece.start, piece.end)?.mark ?? null) : null;
      return { runs, mark: { on: piece.on, join, index, first: firstOf(index) } };
    }),
    end: line.end,
  };
}

/**
 * The lines with the marks of `sets` (each a step's marks, or the block's `marks` alone), showing
 * those at `shown`. Every set is placed on the plain text of the lines, `texts`, so a mark that
 * names no line or text throws in dev mode whichever step it belongs to.
 */
export function focusLines(
  lines: readonly CodeLine[],
  texts: readonly string[],
  sets: readonly (readonly NeatCodeMark[])[],
  shown: number,
  strict = isDevMode(),
): CodeFocus {
  const placed = sets.map((marks) => placesIn(marks, texts, strict));
  const seen = new Set<number>();
  return {
    lines: lines.map((line, i) =>
      markLine(
        line,
        placed.map((places) => places.filter((place) => place.line === i)),
        shown,
        seen,
      ),
    ),
    marked: placed[shown].length > 0,
  };
}
