/**
 * The last block of a streaming text with its unclosed marks closed, so that what the model has
 * written so far shows as it will once the closing mark arrives, and nothing that was shown
 * reflows then:
 * - an open code fence gets its closing fence on a new line, and nothing inside it is touched;
 * - an open code span gets as many backticks as opened it;
 * - open `**`, `*`, `__` and `_` get theirs, the last opened first;
 * - a link whose address is incomplete (`[text](https://exa`) shows as its text, and an unclosed
 *   link text (`[text`) stays as it is;
 * - a lone mark at the very end (`*`, `**`, `_`, a backtick) is dropped, since nothing follows it
 *   yet.
 *
 * Used only while the text streams; a finished text is shown exactly as written.
 */
export function closeAhead(tail: string): string {
  const fence = /^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)/.exec(tail);
  if (fence) return closeFence(tail, fence[1], fence[0].length);
  return closeInline(withoutLoneMark(withoutPartialLink(tail)));
}

/**
 * A run of marks at the very end after a space (or alone) opens nothing yet and closes nothing:
 * it is what the model is about to write, so it is left out until the next text comes.
 */
function withoutLoneMark(tail: string): string {
  return tail.replace(/(^|\s)(?:\*+|_+|`+)\s*$/, '$1').trimEnd();
}

/** An open fence's block, closed; a fence closed inside the block leaves it as written. */
function closeFence(tail: string, opening: string, bodyStart: number): string {
  const char = opening[0];
  const closing = new RegExp(`^ {0,3}\\${char}{${opening.length},}[ \\t]*$`, 'm');
  if (closing.test(tail.slice(bodyStart))) return tail;
  return `${tail.replace(/\n$/, '')}\n${opening}`;
}

/** `[text](partial` at the end, as its text. An image's (`![alt](partial`) shows its alt text. */
function withoutPartialLink(tail: string): string {
  return tail.replace(/!?\[([^\]\n]*)\]\([^)\s]*$/, '$1');
}

type Mark = '**' | '*' | '__' | '_';

function closeInline(text: string): string {
  const open: Mark[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '\\') {
      i += 2;
      continue;
    }
    if (char === '`') {
      const run = runLength(text, i, '`');
      const close = findRun(text, i + run, '`', run);
      if (close === -1) {
        const rest = text.slice(i + run);
        if (rest.trim() === '') return withMarks(text.slice(0, i), open);
        return `${text.trimEnd()}${'`'.repeat(run)}`;
      }
      i = close + run;
      continue;
    }
    if (char === '*' || char === '_') {
      const run = runLength(text, i, char);
      i = takeEmphasis(text, i, char, run, open);
      continue;
    }
    i++;
  }
  return withMarks(text, open);
}

/**
 * Takes the run of `char` at `start` as opening or closing marks (or neither, by CommonMark's
 * flanking rules in their simple form) and returns the index after it.
 */
function takeEmphasis(text: string, start: number, char: '*' | '_', run: number, open: Mark[]) {
  const before = start > 0 ? text[start - 1] : ' ';
  const after = start + run < text.length ? text[start + run] : ' ';
  const space = (c: string) => /\s/.test(c);
  const word = (c: string) => /[\p{L}\p{N}]/u.test(c);
  // An underscore inside a word (snake_case) is no mark; a star is, as in CommonMark.
  const canOpen = !space(after) && (char === '*' || !word(before));
  const canClose = !space(before) && (char === '*' || !word(after));
  let left = run;
  const marks: Mark[] = char === '*' ? ['**', '*'] : ['__', '_'];
  while (left > 0) {
    const mark = left >= 2 ? marks[0] : marks[1];
    const top = open[open.length - 1];
    if (canClose && open.includes(mark)) {
      // Close it and whatever was opened inside it, as a renderer would.
      while (open.length && open[open.length - 1] !== mark) open.pop();
      open.pop();
    } else if (canOpen && (top !== mark || !canClose)) {
      open.push(mark);
    }
    left -= mark.length;
  }
  return start + run;
}

/** The text with its open marks closed, the last opened first; a lone mark at the end dropped. */
function withMarks(text: string, open: Mark[]): string {
  let body = text.trimEnd();
  while (open.length) {
    const last = open[open.length - 1];
    if (!body.endsWith(last)) break;
    // The mark is the last thing written: nothing follows it yet, so it is dropped.
    body = body.slice(0, -last.length).trimEnd();
    open.pop();
  }
  return body + [...open].reverse().join('');
}

function runLength(text: string, start: number, char: string): number {
  let end = start;
  while (text[end] === char) end++;
  return end - start;
}

/** The index of the next run of exactly `length` `char`s from `from`, or -1. */
function findRun(text: string, from: number, char: string, length: number): number {
  for (let i = from; i < text.length;) {
    if (text[i] !== char) {
      i++;
      continue;
    }
    const run = runLength(text, i, char);
    if (run === length) return i;
    i += run;
  }
  return -1;
}
