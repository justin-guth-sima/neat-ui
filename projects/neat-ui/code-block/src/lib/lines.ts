/**
 * The kinds of code text the block colors, each drawn in the theme's `--neat-code-<kind>`.
 * Anything else (names, operators, punctuation) is the block's own text color.
 */
export type CodeKind =
  'keyword' | 'string' | 'comment' | 'constant' | 'type' | 'function' | 'property' | 'tag';

/** A stretch of one line's text and its kind, `null` for text the block does not color. */
export interface CodeRun {
  readonly text: string;
  readonly kind: CodeKind | null;
}

/**
 * One line as the block shows it: its runs, then its line break (`''` on the last line), so the
 * lines' text is the code as given.
 */
export interface CodeLine {
  readonly runs: readonly CodeRun[];
  readonly end: '' | '\n';
}

/**
 * The lines of code split at its line breaks, from each line's runs. Code that ends with a line
 * break has an empty last row, which is not a line of its own: the line before it keeps the break.
 */
export function codeLines(rows: readonly (readonly CodeRun[])[]): CodeLine[] {
  const empty = (row: readonly CodeRun[]) => row.every((run) => !run.text);
  const shown = rows.length > 1 && empty(rows[rows.length - 1]) ? rows.length - 1 : rows.length;
  return rows.slice(0, shown).map((runs, i) => ({ runs, end: i < rows.length - 1 ? '\n' : '' }));
}

/** The code's lines uncolored: what a block shows without a language, and while one loads. */
export function plainLines(code: string): CodeLine[] {
  return codeLines(code.split('\n').map((text) => (text ? [{ text, kind: null }] : [])));
}
