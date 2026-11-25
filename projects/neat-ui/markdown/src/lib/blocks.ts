import { marked, type Token } from 'marked';
import { closeAhead } from './close-ahead';

/** One block of a Markdown text (a paragraph, a list, a code block) as `marked` lexed it. */
export interface MarkdownBlock {
  /** Stable while the block is shown: its place in the text. */
  readonly key: string;
  readonly token: Token;
  /** True once nothing written later can change it. */
  readonly final: boolean;
}

type Lex = (source: string) => Token[];

const lexMarked: Lex = (source) => marked.lexer(source);

/**
 * The blocks of one text that grows as it streams. Blocks before the last are finished: a later
 * update whose text starts with the previous one keeps them (the same objects, so a template
 * tracking them by key leaves their elements alone) and lexes only from the start of the last
 * block. While streaming, the last block is lexed closed ahead (`closeAhead`). A text that is no
 * continuation of the previous one is lexed whole.
 */
export class MarkdownBlocks {
  private text = '';
  private finished: MarkdownBlock[] = [];
  /** Where the finished blocks end in `text`. */
  private finishedEnd = 0;

  constructor(private readonly lex: Lex = lexMarked) {}

  update(raw: string, streaming: boolean): readonly MarkdownBlock[] {
    // marked reads \r\n and \r as \n; the offsets below count in the same characters.
    const text = raw.replace(/\r\n?/g, '\n');
    if (!text.startsWith(this.text)) this.reset();
    this.text = text;

    const tail = text.slice(this.finishedEnd);
    const tokens = this.lex(tail);
    if (tokens.reduce((sum, token) => sum + token.raw.length, 0) !== tail.length) {
      // The lexer's pieces do not add up to the text (it rewrote some): lex it all, keep nothing.
      return this.relexWhole(text, streaming);
    }
    const lastIndex = lastBlockIndex(tokens);
    let offset = this.finishedEnd;
    for (let i = 0; i < lastIndex; i++) {
      const token = tokens[i];
      offset += token.raw.length;
      if (token.type === 'space') {
        this.finishedEnd = offset;
        continue;
      }
      this.finished.push({ key: `b${this.finished.length}`, token, final: true });
      this.finishedEnd = offset;
    }
    return [...this.finished, ...this.lastBlocks(text.slice(this.finishedEnd), streaming)];
  }

  /** The last block (and any space after it), closed ahead while streaming. */
  private lastBlocks(source: string, streaming: boolean): MarkdownBlock[] {
    const tokens = this.lex(streaming ? closeAhead(source) : source);
    return tokens
      .filter((token) => token.type !== 'space')
      .map((token, i) => ({
        key: `b${this.finished.length + i}`,
        token,
        final: !streaming,
      }));
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

/** The index of the last token that is not space, or the length when there is none. */
function lastBlockIndex(tokens: readonly Token[]): number {
  for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i].type !== 'space') return i;
  return tokens.length;
}
