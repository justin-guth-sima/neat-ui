import { MarkdownBlocks } from '../blocks';
import { type ReadableBlock, readableBlocks } from './readable';
import { splitSentences } from './sentences';

/** A sentence of a reply as read aloud speaks it. */
export interface NeatSpeakableSentence {
  /** What to speak: the sentence's words without Markdown, line breaks as spaces, trimmed. */
  readonly text: string;
  /** Its range in the Markdown text, as `text.slice(from, to)`. Stable while the text grows. */
  readonly from: number;
  readonly to: number;
  /** Whether nothing written later can change it; a streaming text's last sentence may not be. */
  readonly complete: boolean;
}

/** How `neatSpeakable` reads a text. */
export interface NeatSpeakableOptions {
  /** The text is complete; `true` by default. Pass false while it streams. */
  readonly final?: boolean;
  /**
   * The longest sentence, in characters; longer ones are cut at a comma, else a space. Unlimited
   * by default.
   */
  readonly maxLength?: number;
}

/**
 * The sentences a reply is read aloud in, from its Markdown text: each one's words without the
 * Markdown and its range in the text, so what an app speaks and what `neat-markdown`'s `speech`
 * lights are the same characters.
 *
 * ```ts
 * for (const sentence of neatSpeakable(reply.text, { final: false })) {
 *   if (sentence.complete && sentence.from >= spokenTo) speak(sentence);
 * }
 * ```
 *
 * It reads what `neat-markdown` shows as prose, inline code included, and never code blocks,
 * tables, pictures or raw HTML. A heading, a paragraph, a list item and a quote's text each end
 * their sentence. Sentences end at `.`, `!`, `?` or `…` followed by a space (closing quotes and
 * brackets kept with them; not after a decimal point, an initial or an abbreviation such as "e.g."
 * or "z.B."), and at the CJK `。！？` with no space needed, so Japanese reads sentence by sentence.
 *
 * While a reply streams, pass `final: false`: the text is read as `neat-markdown` shows it then
 * (half-finished Markdown closed ahead), and its last sentence is not `complete` until whitespace
 * or another block follows it, so a paragraph before a streaming code block is complete. A
 * complete sentence keeps its range and words as the text grows. Ranges count a line end as one
 * character, as Markdown reads `\r\n`.
 */
export function neatSpeakable(
  text: string,
  options: NeatSpeakableOptions = {},
): readonly NeatSpeakableSentence[] {
  const final = options.final ?? true;
  const maxLength = options.maxLength ?? Number.POSITIVE_INFINITY;
  const source = text.replace(/\r\n?/g, '\n');
  const blocks = readableBlocks(new MarkdownBlocks().update(source, !final), source);
  const sentences: NeatSpeakableSentence[] = [];
  for (const block of blocks) {
    const { spoken, sources } = spokenOf(block, source);
    for (const range of splitSentences(spoken, final || !block.last, maxLength)) {
      let first = range.from;
      while (first < range.to && sources[first] < 0) first++;
      let last = range.to - 1;
      while (last >= first && sources[last] < 0) last--;
      if (last < first) continue;
      sentences.push({
        text: spoken.slice(range.from, range.to).replace(/\s+/g, ' ').trim(),
        from: sources[first],
        to: sources[last] + 1,
        complete: range.complete,
      });
    }
  }
  return sentences;
}

/**
 * A readable block as it is spoken: its leaves' text, with a space where a line break lies between
 * two leaves (a hard break, which shows no text), and each character's source offset (-1 for such
 * a space).
 */
function spokenOf(block: ReadableBlock, source: string): { spoken: string; sources: Int32Array } {
  let spoken = '';
  const offsets: number[] = [];
  let previous = -1;
  for (const leaf of block.leaves) {
    const first = leaf.sources.find((offset) => offset >= 0) ?? -1;
    if (previous >= 0 && first > previous && source.slice(previous + 1, first).includes('\n')) {
      spoken += ' ';
      offsets.push(-1);
    }
    spoken += leaf.text;
    for (const offset of leaf.sources) offsets.push(offset);
    for (const offset of leaf.sources) if (offset >= 0) previous = offset;
  }
  return { spoken, sources: Int32Array.from(offsets) };
}
