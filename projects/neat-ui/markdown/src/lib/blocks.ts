import { marked, type Token } from 'marked';
import { closeAhead } from './close-ahead';

/** One block of a Markdown text (a paragraph, a list, a code block) as `marked` lexed it. */
export interface MarkdownBlock {
  /** Stable while the block is shown: its place in the text. */
  readonly key: string;
  readonly token: Token;
  /**
   * Where the block starts in the text (line ends counted as one character, as `marked` reads
   * them). For the live blocks of a streaming text it is where their raw starts as written;
   * closing ahead changes only the last block's end.
   */
  readonly from: number;
  /** True once nothing written later can change it. */
  readonly final: boolean;
}

type Lex = (source: string) => Token[];

const lexMarked: Lex = (source) => marked.lexer(source);

/**
 * The blocks of one text that grows as it streams. Blocks before the last two are finished: a
 * later update whose text starts with the previous one keeps them (the same objects, so a template
 * tracking them by key leaves their elements alone) and lexes only from the start of the last two
 * blocks, so the work per update grows with those blocks, not with the text. While streaming, the
 * live blocks are lexed closed ahead (`closeAhead`). A text that is no
 * continuation of the previous one is lexed whole.
 */
export class MarkdownBlocks {
  private text = '';
  private finished: MarkdownBlock[] = [];
  /** Where the finished blocks end in `text`. */
  private finishedEnd = 0;

  /**
   * How many characters the last update added to the text, or null when the text is no
   * continuation of the one before.
   */
  get grown(): number | null {
    return this.lastGrown;
  }

  private lastGrown: number | null = null;

  constructor(private readonly lex: Lex = lexMarked) {}

  update(raw: string, streaming: boolean): readonly MarkdownBlock[] {
    // marked reads \r\n and \r as \n; the offsets below count in the same characters.
    const text = raw.replace(/\r\n?/g, '\n');
    if (text.startsWith(this.text)) {
      this.lastGrown = text.length - this.text.length;
    } else {
      this.reset();
      this.lastGrown = null;
    }
    this.text = text;

    const tail = text.slice(this.finishedEnd);
    const tokens = this.lex(tail);
    if (tokens.reduce((sum, token) => sum + token.raw.length, 0) !== tail.length) {
      // The lexer's pieces do not add up to the text (it rewrote some): lex it all, keep nothing.
      return this.relexWhole(text, streaming);
    }
    const liveFrom = liveIndex(tokens);
    let offset = this.finishedEnd;
    for (let i = 0; i < liveFrom; i++) {
      const token = tokens[i];
      const from = offset;
      offset += token.raw.length;
      if (token.type === 'space') {
        this.finishedEnd = offset;
        continue;
      }
      this.finished.push({ key: `b${this.finished.length}`, token, from, final: true });
      this.finishedEnd = offset;
    }
    return [...this.finished, ...this.lastBlocks(text.slice(this.finishedEnd), streaming)];
  }

  /** The live blocks (and any space after them), closed ahead while streaming. */
  private lastBlocks(source: string, streaming: boolean): MarkdownBlock[] {
    const tokens = this.lex(streaming ? closeAhead(source) : source);
    const blocks: MarkdownBlock[] = [];
    let from = this.finishedEnd;
    for (const token of tokens) {
      if (token.type !== 'space') {
        blocks.push({
          key: `b${this.finished.length + blocks.length}`,
          token,
          from,
          final: !streaming,
        });
      }
      from += token.raw.length;
    }
    return blocks;
  }

  private relexWhole(text: string, streaming: boolean): readonly MarkdownBlock[] {
    this.reset();
    this.text = text;
    return this.lastBlocks(text, streaming);
  }

  private reset(): void {
    this.text = '';
    this.finished = [];
    this.finishedEnd = 0;
  }
}

/**
 * Where the live blocks start: the last two tokens that are not space, or the length when there
 * are none. Two, not one: the block before the last can still change with what comes, as a list
 * does when the line after its blank line becomes its next item (`1. First` then `2`, a paragraph
 * until `2.` makes it an item of the same list).
 */
function liveIndex(tokens: readonly Token[]): number {
  let blocks = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type !== 'space' && ++blocks === LIVE_BLOCKS) return i;
  }
  return blocks > 0 ? 0 : tokens.length;
}

/** How many blocks at the end of a streaming text stay live. */
const LIVE_BLOCKS = 2;
