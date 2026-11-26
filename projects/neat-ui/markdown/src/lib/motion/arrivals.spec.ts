import { MarkdownBlocks } from '../blocks';
import { TextArrivals } from './arrivals';
import { type PieceGroup, type ShownPiece, shownLeaves } from './shown';

/** A text streamed write by write, as NeatMarkdown feeds it. */
function stream(options: { settleMs?: number; group?: PieceGroup; arrivals?: TextArrivals } = {}) {
  const blocks = new MarkdownBlocks();
  const arrivals = options.arrivals ?? new TextArrivals();
  let text = '';
  return {
    arrivals,
    write(next: string, now = 0) {
      const grown = Math.max(0, next.length - text.length);
      text = next;
      return arrivals.update(
        blocks.update(next, true),
        grown,
        now,
        options.settleMs ?? 1000,
        options.group ?? 'token',
      );
    },
  };
}

/** The pieces with an arrival, as [text, index]. */
function moving(pieces: ReadonlyMap<unknown, readonly ShownPiece[]>): [string, number][] {
  return [...pieces.values()]
    .flat()
    .filter((piece) => piece.arrival)
    .map((piece) => [piece.text, piece.arrival!.index]);
}

describe('TextArrivals', () => {
  it("the first write's text is one arrival", () => {
    const pieces = stream().write('Three');
    expect(moving(pieces)).toEqual([['Three', 0]]);
    expect([...pieces.values()][0][0].arrival).toMatchObject({ from: 0, to: 5, at: 0 });
  });

  it('each growing write adds one arrival with the next index', () => {
    const reply = stream();
    reply.write('Three', 0);
    reply.write('Three jars', 10);
    const pieces = reply.write('Three jars of', 20);
    expect(moving(pieces)).toEqual([
      ['Three', 0],
      [' jars', 1],
      [' of', 2],
    ]);
  });

  it('text after a code block arrives at the right offsets', () => {
    const reply = stream();
    const before = 'Intro.\n\n```py\nx = 1\n```\n\nThen';
    reply.write(before, 0);
    const pieces = reply.write(`${before} more`, 50);
    const last = moving(pieces).at(-1)!;
    expect(last).toEqual([' more', 1]);
    const piece = [...pieces.values()].flat().find((shown) => shown.text === ' more')!;
    // "Intro." is 6 shown characters, the code block none, "Then" 4.
    expect(piece.arrival).toMatchObject({ from: 10, to: 15 });
  });

  it('a resolution earlier in the text shows plain', () => {
    const reply = stream();
    reply.write('Prices\n\n| a | b |', 0);
    reply.write('Prices\n\n| a | b |\n|---|---|', 10);
    const pieces = reply.write('Prices\n\n| a | b |\n|---|---|\n\nAfter', 20);
    // The header row became a table: what it showed as a paragraph never arrives again.
    expect(moving(pieces)).toEqual([
      ['Prices', 0],
      ['After', 1],
    ]);
  });

  it('arrivals older than settleMs drop out', () => {
    const reply = stream({ settleMs: 100 });
    reply.write('One', 0);
    reply.write('One two', 50);
    expect(moving(reply.write('One two three', 120))).toEqual([
      [' two', 1],
      [' three', 2],
    ]);
  });

  it('drops a word arrival by the time of its last letter', () => {
    const reply = stream({ settleMs: 100, group: 'word' });
    reply.write('Seventeen', 0);
    // Its last letter starts at 8 × 18 = 144 ms, so at 200 ms it still moves.
    expect(moving(reply.write('Seventeen a', 200))).toEqual([
      ['Seventeen', 0],
      ['a', 1],
    ]);
    expect(moving(reply.write('Seventeen ab', 250))).toEqual([['ab', 1]]);
  });

  it('reset forgets every arrival and starts the index again', () => {
    const arrivals = new TextArrivals();
    const first = stream({ arrivals });
    first.write('One', 0);
    first.write('One two', 10);
    arrivals.reset();
    const second = stream({ arrivals });
    expect(moving(second.write('Other', 20))).toEqual([['Other', 0]]);
  });

  it('a write that adds nothing records nothing', () => {
    const reply = stream({ settleMs: 1000 });
    reply.write('Some **bold', 0);
    // The closing marks arrive: the shown prose is the same.
    expect(moving(reply.write('Some **bold**', 10))).toEqual([
      ['Some ', 0],
      ['bold', 0],
    ]);
  });

  it('the work per update stays flat over a long reply', () => {
    let walked = 0;
    const counting: typeof shownLeaves = (tokens, from) => {
      const result = shownLeaves(tokens, from);
      walked += result.leaves.length;
      return result;
    };
    const reply = stream({ settleMs: 400, arrivals: new TextArrivals(counting) });
    const words = Array.from({ length: 2000 }, (_, i) =>
      i % 40 === 39
        ? 'end.\n\n'
        : i % 7 === 0
          ? '**bold** '
          : i % 97 === 0
            ? '\n\n- item '
            : 'word ',
    );
    let text = '';
    const perUpdate: number[] = [];
    words.forEach((word, i) => {
      text += word;
      walked = 0;
      reply.write(text, i * 20);
      perUpdate.push(walked);
    });
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    expect(sum(perUpdate.slice(-100))).toBeLessThan(2 * sum(perUpdate.slice(0, 100)));
  });
});
