/*
 * Where the sentences of a text end, as read aloud speaks them: at a full stop, question or
 * exclamation mark or ellipsis that whitespace follows (after any closing quotes), not after a
 * decimal point, an initial or an abbreviation; the CJK full stops need no whitespace after them.
 * Ported unchanged from GenAI Studio's Read aloud splitter. Internal.
 */

const ENDS = '.!?…';
const CJK_ENDS = '。！？';
const CLOSERS = '"\'”’»」』';
// Words whose full stop ends no sentence (compared in lower case, their inner dots kept).
const ABBREVIATIONS = new Set([
  'e.g',
  'i.e',
  'cf',
  'vs',
  'dr',
  'mr',
  'mrs',
  'ms',
  'prof',
  'st',
  'no',
  'z.b',
  'd.h',
  'u.a',
  'bzw',
  'ca',
  'nr',
  'evtl',
  'ggf',
  'mme',
  'mlle',
  'sr',
  'sra',
  'p.ej',
]);
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const SPACE = /\s/;

function abbreviated(text: string, dot: number): boolean {
  const word = /[\p{L}.]*$/u.exec(text.slice(0, dot))?.[0].replace(/^\.+/, '') ?? '';
  return word.length === 1 || ABBREVIATIONS.has(word.toLowerCase());
}

/**
 * Where the first complete sentence in `text` from `from` ends (the index after it, closers
 * included), or -1. With `final`, the text's end completes a sentence too.
 */
function sentenceEnd(text: string, from: number, final: boolean): number {
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    const cjk = CJK_ENDS.includes(char);
    if (!cjk && !ENDS.includes(char)) continue;
    let end = i + 1;
    while (end < text.length && (ENDS.includes(text[end]) || CJK_ENDS.includes(text[end]))) end++;
    while (end < text.length && CLOSERS.includes(text[end])) end++;
    if (end === text.length) {
      if (final) return end;
      return -1; // what follows decides: a closer, more text, or whitespace
    }
    const next = text[end];
    if (cjk || SPACE.test(next)) {
      if (char === '.' && end === i + 1 && abbreviated(text, i)) continue;
      return end;
    }
    i = end - 1;
  }
  return -1;
}

/** A sentence's range in the text it was split from. */
export interface SentenceRange {
  readonly from: number;
  readonly to: number;
  /** Whether nothing written later can change it. */
  readonly complete: boolean;
}

/**
 * The sentences of `text`, each without the whitespace around it, as ranges; what has no letter
 * or digit is left out. `final` says the text is complete, so its last sentence is too. A
 * sentence longer than `maxLength` is cut into parts (`fitSentence`'s rule); the parts before
 * its last are complete.
 */
export function splitSentences(text: string, final: boolean, maxLength: number): SentenceRange[] {
  const sentences: SentenceRange[] = [];
  const add = (from: number, to: number, complete: boolean) => {
    while (from < to && SPACE.test(text[from])) from++;
    while (to > from && SPACE.test(text[to - 1])) to--;
    if (!LETTER_OR_DIGIT.test(text.slice(from, to))) return;
    for (const part of fitSentence(text, from, to, maxLength, complete)) sentences.push(part);
  };
  let start = 0;
  let end: number;
  while ((end = sentenceEnd(text, start, final)) >= 0) {
    add(start, end, true);
    start = end;
  }
  if (start < text.length) add(start, text.length, final);
  return sentences;
}

/**
 * The sentence `[from, to)` of `text` in parts of at most `max` characters: cut at a comma (in its
 * second half), else at a space, else anywhere; each part without the spaces around it.
 */
function fitSentence(
  text: string,
  from: number,
  to: number,
  max: number,
  complete: boolean,
): SentenceRange[] {
  const parts: SentenceRange[] = [];
  let rest = from;
  while (to - rest > max) {
    const window = text.slice(rest, rest + max);
    const comma = Math.max(
      window.lastIndexOf(','),
      window.lastIndexOf('、'),
      window.lastIndexOf('，'),
    );
    const space = window.lastIndexOf(' ');
    const cut = comma >= max / 2 ? comma + 1 : space > 0 ? space : max;
    let end = rest + cut;
    while (end > rest && SPACE.test(text[end - 1])) end--;
    parts.push({ from: rest, to: end, complete: true });
    rest += cut;
    while (rest < to && SPACE.test(text[rest])) rest++;
  }
  if (rest < to) parts.push({ from: rest, to, complete });
  return parts;
}
