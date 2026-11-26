import { marked, type Token } from 'marked';
import { type Arrival, piecesOf, type ShownLeaf, shownLeaves } from './shown';

const leavesOf = (markdown: string) => shownLeaves(marked.lexer(markdown), 0);

const leaf = (text: string, from = 0): ShownLeaf => ({
  token: { type: 'text', raw: text, text } as Token,
  from,
  text,
});

const arrival = (from: number, to: number, at = 0, index = 0): Arrival => ({
  from,
  to,
  at,
  index,
});

describe('shownLeaves', () => {
  it('lists the prose runs in the order the template prints them', () => {
    const { leaves, end } = leavesOf(
      '# Title\n\nSome **bold** and [a link](https://example.com).\n\n- one\n- two',
    );
    expect(leaves.map((shown) => shown.text)).toEqual([
      'Title',
      'Some ',
      'bold',
      ' and ',
      'a link',
      '.',
      'one',
      'two',
    ]);
    let offset = 0;
    for (const shown of leaves) {
      expect(shown.from).toBe(offset);
      offset += shown.text.length;
    }
    expect(end).toBe(offset);
  });

  it('leaves out code blocks, tables, inline code and images', () => {
    expect(leavesOf('a `x` b').leaves.map(({ text, from }) => [text, from])).toEqual([
      ['a ', 0],
      [' b', 2],
    ]);
    const { leaves } = leavesOf(
      'Before\n\n```js\nlet a = 1;\n```\n\n| k | v |\n|---|---|\n| a | 1 |\n\n![alt](x.png) after',
    );
    expect(leaves.map((shown) => shown.text)).toEqual(['Before', ' after']);
  });

  it('counts escapes and quotes, and starts at the offset it is given', () => {
    const { leaves, end } = shownLeaves(marked.lexer('> a \\* b'), 10);
    expect(leaves.map(({ text, from }) => [text, from])).toEqual([
      ['a ', 10],
      ['*', 12],
      [' b', 13],
    ]);
    expect(end).toBe(15);
  });
});

describe('piecesOf', () => {
  it('cuts a leaf at arrival boundaries', () => {
    const pieces = piecesOf(leaf('Three jars of'), [arrival(6, 10, 5, 1)], 'token')!;
    expect(pieces.map(({ start, text, arrival }) => [start, text, arrival?.index ?? null])).toEqual(
      [
        [0, 'Three ', null],
        [6, 'jars', 1],
        [10, ' of', null],
      ],
    );
  });

  it('cuts a leaf that starts inside an arrival in offsets of the shown prose', () => {
    const pieces = piecesOf(leaf('jars', 20), [arrival(18, 22)], 'token')!;
    expect(pieces.map(({ start, text }) => [start, text])).toEqual([
      [20, 'ja'],
      [22, 'rs'],
    ]);
  });

  it("groups by word, reaching back to the word's start", () => {
    const pieces = piecesOf(leaf('a pomodoro'), [arrival(6, 10, 100, 3)], 'word')!;
    expect(pieces.map(({ start, text }) => [start, text])).toEqual([
      [0, 'a '],
      [2, 'pomodoro'],
    ]);
    const word = pieces[1];
    expect(word.arrival?.index).toBe(3);
    expect(word.letters!.map((letter) => letter.at)).toEqual([
      null,
      null,
      null,
      null,
      100,
      118,
      136,
      154,
    ]);
  });

  it('keeps whitespace outside the word pieces', () => {
    const pieces = piecesOf(leaf('one two'), [arrival(0, 7)], 'word')!;
    expect(pieces.map(({ text, arrival }) => [text, arrival !== null])).toEqual([
      ['one', true],
      [' ', false],
      ['two', true],
    ]);
  });

  it('returns null for a leaf no arrival touches', () => {
    expect(piecesOf(leaf('settled', 0), [arrival(7, 9)], 'token')).toBeNull();
    expect(piecesOf(leaf('settled', 10), [arrival(0, 10)], 'word')).toBeNull();
  });
});
