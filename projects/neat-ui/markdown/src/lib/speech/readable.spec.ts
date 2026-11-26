import { describe, expect, it } from 'vitest';
import { MarkdownBlocks } from '../blocks';
import { readableBlocks, readableRange, type ReadableBlock } from './readable';

/** The readable blocks of a text, lexed as the component lexes it. */
function read(text: string, streaming = false): readonly ReadableBlock[] {
  return readableBlocks(new MarkdownBlocks().update(text, streaming), text);
}

/** Each block's readable text. */
const texts = (blocks: readonly ReadableBlock[]) =>
  blocks.map((block) => block.leaves.map((leaf) => leaf.text).join(''));

/** Each readable character with the source character it maps to, as `x>x`. */
function mapping(text: string, blocks: readonly ReadableBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.leaves.flatMap((leaf) =>
      [...leaf.text].map((char, i) => `${char}>${text[leaf.sources[i]] ?? '?'}`),
    ),
  );
}

describe('readableBlocks', () => {
  it('reads prose and inline code, not code blocks, tables, images or checkboxes', () => {
    const text =
      'Run `main()` now.\n\n```\nx = 1\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n' +
      '![a jar](jar.png) Look.\n\n- [x] Done *item*\n- Next <b>raw</b> one';
    expect(texts(read(text))).toEqual(['Run main() now.', ' Look.', 'Done item', 'Next raw one']);
  });

  it('keeps blocks apart: paragraphs, headings, list items, nested items and quotes', () => {
    const text = '## Steps\n\n1. Boil\n2. Warm\n   - nested\n\n> Quoted **bold**\n\nEnd.';
    const blocks = read(text);
    expect(texts(blocks)).toEqual(['Steps', 'Boil', 'Warm', 'nested', 'Quoted bold', 'End.']);
    expect(blocks.map((block) => block.last)).toEqual([false, false, false, false, false, true]);
    let offset = 0;
    for (const block of blocks) {
      expect(block.from).toBe(offset);
      offset = block.to;
    }
  });

  it('maps each character to its source through bold, links, escapes and nested lists', () => {
    const text = 'A **bold** [link](https://x.y) \\* end.\n\n- one\n  - two `c`';
    const blocks = read(text);
    for (const pair of mapping(text, blocks)) {
      const [shown, source] = pair.split('>');
      expect(source, pair).toBe(shown);
    }
    const escape = blocks[0].leaves.find((leaf) => leaf.text === '*')!;
    expect(escape.sources[0]).toBe(text.indexOf('\\*') + 1);
    const code = blocks.at(-1)!.leaves.at(-1)!;
    expect(code.text).toBe('c');
    expect(code.sources[0]).toBe(text.lastIndexOf('c'));
  });

  it('maps a closed-ahead last block to the text as written', () => {
    const text = 'Done.\n\nIt is **bo';
    const blocks = read(text, true);
    expect(texts(blocks)).toEqual(['Done.', 'It is bo']);
    expect(blocks.map((block) => block.last)).toEqual([false, true]);
    for (const pair of mapping(text, blocks)) {
      const [shown, source] = pair.split('>');
      expect(source, pair).toBe(shown);
    }
    const link = 'See [the guide](https://exa';
    expect(texts(read(link, true))).toEqual(['See the guide']);
    for (const pair of mapping(link, read(link, true))) {
      const [shown, source] = pair.split('>');
      expect(source, pair).toBe(shown);
    }
  });

  it('readableRange gives the readable offsets of a source range', () => {
    const text = '**Hello.** World.';
    const blocks = read(text);
    expect(readableRange(blocks, 2, 8)).toEqual({ from: 0, to: 6 });
    expect(readableRange(blocks, 11, 17)).toEqual({ from: 7, to: 13 });
    expect(readableRange(blocks, 0, 17)).toEqual({ from: 0, to: 13 });
  });

  it('readableRange gives null for a range inside a code block', () => {
    const text = 'Run:\n\n```\nprint(1)\n```\n\nDone.';
    const blocks = read(text);
    const inside = text.indexOf('print');
    expect(readableRange(blocks, inside, inside + 8)).toBeNull();
    expect(readableRange(blocks, 500, 600)).toBeNull();
    expect(readableRange(blocks, 3, 3)).toBeNull();
  });
});
