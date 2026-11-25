import { marked, type Token } from 'marked';
import { MarkdownBlocks } from './blocks';

/** A lexer that records what it was given. */
function recordingLexer() {
  const inputs: string[] = [];
  const lex = (source: string): Token[] => {
    inputs.push(source);
    return marked.lexer(source);
  };
  return { lex, inputs };
}

describe('MarkdownBlocks', () => {
  it('splits a text into blocks with stable keys', () => {
    const blocks = new MarkdownBlocks().update(
      'A paragraph.\n\n- one\n- two\n\n```\ncode\n```',
      false,
    );
    expect(blocks.map((block) => block.token.type)).toEqual(['paragraph', 'list', 'code']);
    expect(new Set(blocks.map((block) => block.key)).size).toBe(3);
  });

  it('reuses finished blocks by identity as the text grows', () => {
    const blocks = new MarkdownBlocks();
    let text = 'First paragraph.\n\n- one\n- two\n\nThe third.\n\nThe fourth';
    const first = blocks.update(text, true);
    for (let i = 0; i < 50; i++) {
      text += 'x';
      const next = blocks.update(text, true);
      expect(next[0]).toBe(first[0]);
      expect(next[1]).toBe(first[1]);
      expect(next[2].key).toBe(first[2].key);
      expect(next[3].key).toBe(first[3].key);
    }
  });

  it('lexes only the last two blocks', () => {
    const { lex, inputs } = recordingLexer();
    const blocks = new MarkdownBlocks(lex);
    const long = 'word '.repeat(400).trim();
    let text = `${long}\n\n${long}\n\nShort.\n\nThe tail`;
    blocks.update(text, true);
    inputs.length = 0;
    for (let i = 0; i < 20; i++) {
      text += ' more';
      blocks.update(text, true);
    }
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(input.length).toBeLessThan(200);
  });

  it('a reply that is one long list costs a bounded amount per token', () => {
    const { lex, inputs } = recordingLexer();
    const blocks = new MarkdownBlocks(lex);
    const items = Array.from(
      { length: 40 },
      (_, i) => `${i + 1}. Item ${i} ${'word '.repeat(8)}\n`,
    );
    const pieces = items.join('').match(/\s+|\S+/g)!;
    let text = '';
    let most = 0;
    for (const piece of pieces) {
      text += piece;
      inputs.length = 0;
      blocks.update(text, true);
      most = Math.max(
        most,
        inputs.reduce((sum, input) => sum + input.length, 0),
      );
    }
    // The list is lexed whole (its numbering and looseness depend on all its items), twice at most.
    expect(most).toBeLessThanOrEqual(2 * text.length + 16);
  });

  it('relexes the whole when the text is not a continuation', () => {
    const blocks = new MarkdownBlocks();
    blocks.update('# A\n\nb', true);
    const next = blocks.update('x', true);
    expect(next).toHaveLength(1);
    expect(next[0].token.type).toBe('paragraph');
    expect(next[0].token.raw).toBe('x');
  });

  it('a 2,000-token reply costs about the same per token at the end as at the start', () => {
    const { lex, inputs } = recordingLexer();
    const blocks = new MarkdownBlocks(lex);
    const words = Array.from({ length: 2000 }, (_, i) =>
      i % 40 === 39 ? 'end.\n\n' : i % 7 === 0 ? '**bold** ' : 'word ',
    );
    let text = '';
    const lexedPerUpdate: number[] = [];
    for (const word of words) {
      text += word;
      inputs.length = 0;
      blocks.update(text, true);
      lexedPerUpdate.push(inputs.reduce((sum, input) => sum + input.length, 0));
    }
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    const start = sum(lexedPerUpdate.slice(0, 100));
    const end = sum(lexedPerUpdate.slice(-100));
    expect(end).toBeLessThan(start * 2);
  });

  it('says how much the text grew, and null for a text that is no continuation', () => {
    const blocks = new MarkdownBlocks();
    blocks.update('Three', true);
    expect(blocks.grown).toBe(5);
    blocks.update('Three\r\njars', true);
    expect(blocks.grown).toBe(5);
    blocks.update('Three\r\njars', false);
    expect(blocks.grown).toBe(0);
    blocks.update('Other text, longer than before', true);
    expect(blocks.grown).toBeNull();
  });

  it('marks only the last two blocks not final while streaming', () => {
    const blocks = new MarkdownBlocks().update('one\n\ntwo\n\nthree', true);
    expect(blocks.map((block) => block.final)).toEqual([true, false, false]);
  });

  it('marks every block final once the text is no longer streaming', () => {
    const blocks = new MarkdownBlocks().update('one\n\ntwo', false);
    expect(blocks.map((block) => block.final)).toEqual([true, true]);
  });

  it('lexes the tail closed ahead while streaming, and as written once done', () => {
    const blocks = new MarkdownBlocks();
    const streaming = blocks.update('Some **bo', true);
    expect(JSON.stringify(streaming[0].token)).toContain('"type":"strong"');
    const done = blocks.update('Some **bo', false);
    expect(JSON.stringify(done[0].token)).not.toContain('"type":"strong"');
  });

  it('treats Windows line ends as line ends', () => {
    const blocks = new MarkdownBlocks();
    const first = blocks.update('one\r\n\r\ntwo\r\n\r\nthree', true);
    const next = blocks.update('one\r\n\r\ntwo\r\n\r\nthree more', true);
    expect(next[0]).toBe(first[0]);
    expect(next.map((block) => block.token.type)).toEqual(['paragraph', 'paragraph', 'paragraph']);
  });
});

/** Replies as a model writes them: each streamed must end as the same blocks as read whole. */
const CORPUS = [
  '1. First\n\n2. Second\n\n3. Third',
  '1. **A**\n\n   - x\n   - y\n\n2. **B**\n\n   - z',
  '1. Run:\n\n   ```bash\n   ls -la\n   ```\n\n2. Then:\n\n   ```bash\n   cd /tmp\n   ```',
  'Here it is:\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n\nDone.',
  'Title\n=====\n\nSome text.',
  '> quoted\n> - with a list\n> - of two\n\nAfter.',
  'Text.\n\n```python\nx = 1\n\ny = 2\n```\n\nMore text.',
  '## Steps\n\n- one\n- two\n\n```js\nlet a = 1;\n```\n\n| k | v |\n|---|---|\n| a | 1 |',
  '- a\n\n  b continues a\n\n- c',
];

/** A token as the lexer gives it, without what differs only by where lexing began. */
function shape(token: Token): unknown {
  return JSON.parse(JSON.stringify(token));
}

describe('MarkdownBlocks against a whole lex', () => {
  it.each(CORPUS.map((text) => [text]))('streams %j to the blocks of a whole lex', (text) => {
    const blocks = new MarkdownBlocks();
    for (let end = 1; end <= text.length; end++) blocks.update(text.slice(0, end), true);
    const streamed = blocks.update(text, false).map((block) => shape(block.token));
    const whole = marked
      .lexer(text)
      .filter((token) => token.type !== 'space')
      .map(shape);
    expect(streamed).toEqual(whole);
  });
});
