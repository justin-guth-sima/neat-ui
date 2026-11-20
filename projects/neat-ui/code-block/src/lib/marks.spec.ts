import { plainLines, type CodeLine } from './lines';
import { focusLines, type CodeFocus, type NeatCodeMark } from './marks';

const CODE = 'model = Model(path)\nmodel.run(frame)\nprint(model.run)\n';
const LINES = plainLines(CODE);
const TEXTS = LINES.map((line) => line.runs.map((run) => run.text).join(''));

const focus = (sets: NeatCodeMark[][], shown = 0, lines: readonly CodeLine[] = LINES) =>
  focusLines(lines, TEXTS, sets, shown, true);

/** Each line as text, its shown marks in [brackets] and its marks not shown in (parentheses). */
function drawn(code: CodeFocus): string[] {
  return code.lines.map((line) => {
    const text = line.pieces
      .map((piece) => {
        const text = piece.runs.map((run) => run.text).join('');
        if (!piece.mark) return text;
        return piece.mark.on ? `[${text}]` : `(${text})`;
      })
      .join('');
    return line.band === null ? text : `${line.band ? '█' : '░'} ${text}`;
  });
}

describe('the code block marks', () => {
  it('mark whole lines by their numbers from 1, a range including both ends', () => {
    const code = focus([[{ lines: [1, 2] }]]);

    expect(drawn(code)).toEqual([
      '█ model = Model(path)',
      '█ model.run(frame)',
      'print(model.run)',
    ]);
    expect(code.marked).toBe(true);
  });

  it('mark one line alone', () => {
    expect(drawn(focus([[{ line: 3 }]]))[2]).toBe('█ print(model.run)');
  });

  it('mark the first occurrence of a text on its line', () => {
    expect(drawn(focus([[{ line: 3, text: 'model' }]]))[2]).toBe('print([model].run)');
  });

  it('mark columns from 1, both ends included, for text that comes again on its line', () => {
    expect(drawn(focus([[{ line: 1, from: 9, to: 13 }]]))[0]).toBe('model = [Model](path)');
  });

  it('cut colored runs where a mark starts and ends, keeping each part’s kind', () => {
    const colored: CodeLine[] = [
      {
        runs: [
          { text: 'model', kind: null },
          { text: '.', kind: null },
          { text: 'run', kind: 'function' },
          { text: '(frame)', kind: null },
        ],
        end: '\n',
      },
    ];
    const code = focusLines(
      colored,
      ['model.run(frame)'],
      [[{ line: 1, from: 4, to: 11 }]],
      0,
      true,
    );

    expect(code.lines[0].pieces).toEqual([
      { runs: [{ text: 'mod', kind: null }], mark: null },
      {
        runs: [
          { text: 'el', kind: null },
          { text: '.', kind: null },
          { text: 'run', kind: 'function' },
          { text: '(f', kind: null },
        ],
        mark: { on: true, join: null, index: 0, first: true },
      },
      { runs: [{ text: 'rame)', kind: null }], mark: null },
    ]);
  });

  it('cut each line at the marks of every step, so its elements stay from step to step', () => {
    const sets: NeatCodeMark[][] = [
      [{ line: 2, text: 'model' }],
      [{ line: 2, text: 'run' }, { line: 1 }],
    ];

    expect(drawn(focus(sets, 0)).slice(0, 2)).toEqual([
      '░ model = Model(path)',
      '[model].(run)(frame)',
    ]);
    expect(drawn(focus(sets, 1)).slice(0, 2)).toEqual([
      '█ model = Model(path)',
      '(model).[run](frame)',
    ]);
  });

  it('join the markers of shown marks that touch or overlap, square where they meet', () => {
    const code = focus([
      [
        { line: 2, text: 'model' },
        { line: 2, from: 4, to: 9 },
      ],
    ]);

    expect(drawn(code)[1]).toBe('[mod][el][.run](frame)');
    expect(code.lines[1].pieces.map((piece) => piece.mark?.join)).toEqual([
      'end',
      'both',
      'start',
      undefined,
    ]);
  });

  it('show no part marks on a line the same step marks whole', () => {
    expect(drawn(focus([[{ line: 2 }, { line: 2, text: 'run' }]]))[1]).toBe('█ model.run(frame)');
  });

  it('have nothing marked for no marks, or a step with none', () => {
    expect(focus([[]]).marked).toBe(false);
    expect(focus([[{ line: 1 }], []], 1).marked).toBe(false);
    expect(drawn(focus([[]]))).toEqual(TEXTS);
  });

  it.each<[string, NeatCodeMark, string]>([
    ['a line before the first', { line: 0 }, 'names no line'],
    ['a line past the last', { line: 4 }, 'the code has lines 1 to 3'],
    ['lines the wrong way round', { lines: [3, 2] }, 'names no lines'],
    ['a line that is not a whole number', { line: 1.5 }, 'names no line'],
    ['text its line does not have', { line: 1, text: 'run' }, 'names no text on line 1'],
    ['empty text', { line: 1, text: '' }, 'names no text'],
    ['columns past the line', { line: 2, from: 10, to: 17 }, 'which has 1 to 16'],
    ['columns the wrong way round', { line: 2, from: 5, to: 4 }, 'names no columns'],
  ])('throw in dev mode for a mark that names %s', (_, mark, problem) => {
    expect(() => focus([[mark]])).toThrow(problem);
  });

  it('throw in dev mode for a mark that gives both text and columns', () => {
    const mark = { line: 1, text: 'model', from: 1, to: 5 } as unknown as NeatCodeMark;

    expect(() => focus([[mark]])).toThrow('give one');
  });

  it('throw in dev mode for a bad mark of a step not shown', () => {
    expect(() => focus([[{ line: 1 }], [{ line: 9 }]], 0)).toThrow('names no line');
  });

  it('leave out a mark that names nothing in production, and keep the others', () => {
    const code = focusLines(
      LINES,
      TEXTS,
      [[{ line: 9 }, { line: 1, text: 'x' }, { line: 2 }]],
      0,
      false,
    );

    expect(drawn(code)).toEqual(['model = Model(path)', '█ model.run(frame)', 'print(model.run)']);
  });

  it('keep the text of every line as it was', () => {
    const code = focus([[{ lines: [1, 3] }, { line: 2, text: 'run' }]]);
    const text = code.lines
      .map(
        (line) =>
          line.pieces.flatMap((piece) => piece.runs.map((run) => run.text)).join('') + line.end,
      )
      .join('');

    expect(text).toBe(CODE);
  });

  it('say which shown mark each element is, and which element is its first', () => {
    // Lines 1 to 2 whole, then "run" on line 3, cut in two by a mark of the step not shown.
    const code = focus(
      [[{ lines: [1, 2] }, { line: 3, text: 'model.run' }], [{ line: 3, text: 'run' }]],
      0,
    );

    expect(code.lines.map((line) => [line.bandIndex, line.bandFirst])).toEqual([
      [0, true],
      [0, false],
      [null, false],
    ]);
    expect(code.lines[2].pieces.filter((piece) => piece.mark).map((piece) => piece.mark)).toEqual([
      { on: true, join: 'end', index: 1, first: true },
      { on: true, join: 'start', index: 1, first: false },
    ]);

    const other = focus(
      [[{ lines: [1, 2] }, { line: 3, text: 'model.run' }], [{ line: 3, text: 'run' }]],
      1,
    );
    expect(other.lines[2].pieces.map((piece) => piece.mark?.index ?? null)).toEqual([
      null,
      null,
      0,
      null,
    ]);
  });
});
