import { codeLines, plainLines, type CodeLine } from './lines';

/** The lines' text joined, as a selection of the whole block reads it. */
const textOf = (lines: readonly CodeLine[]) =>
  lines.map((line) => line.runs.map((run) => run.text).join('') + line.end).join('');

describe('the code block lines', () => {
  it('split the code at its line breaks, each line keeping its break but the last', () => {
    const lines = plainLines('a = 1\n\n  b = 2');

    expect(lines).toEqual([
      { runs: [{ text: 'a = 1', kind: null }], end: '\n' },
      { runs: [], end: '\n' },
      { runs: [{ text: '  b = 2', kind: null }], end: '' },
    ]);
    expect(textOf(lines)).toBe('a = 1\n\n  b = 2');
  });

  it('show no empty line after code that ends with a line break, and still spell it whole', () => {
    const lines = plainLines('a\nb\n');

    expect(lines).toHaveLength(2);
    expect(lines[1].end).toBe('\n');
    expect(textOf(lines)).toBe('a\nb\n');
  });

  it('show empty code as one empty line', () => {
    expect(plainLines('')).toEqual([{ runs: [], end: '' }]);
  });

  it('treat a last row of empty runs, as a highlighter gives it, as no line', () => {
    const lines = codeLines([[{ text: 'x', kind: 'keyword' }], [{ text: '', kind: null }]]);

    expect(lines).toEqual([{ runs: [{ text: 'x', kind: 'keyword' }], end: '\n' }]);
  });
});
