import { describe, expect, it } from 'vitest';
import { splitSentences } from './sentences';

/** The sentences of `text` as their words, each `!` when it is not complete. */
function said(text: string, final = true, maxLength = Number.POSITIVE_INFINITY): string[] {
  return splitSentences(text, final, maxLength).map(
    ({ from, to, complete }) => text.slice(from, to) + (complete ? '' : ' (open)'),
  );
}

describe('splitSentences', () => {
  it('ends a sentence once whitespace follows its full stop, and the rest at the end', () => {
    expect(said('Hello there', false)).toEqual(['Hello there (open)']);
    expect(said('Hello there.', false)).toEqual(['Hello there. (open)']);
    expect(said('Hello there. How', false)).toEqual(['Hello there.', 'How (open)']);
    expect(said('Hello there. How are you? Fine')).toEqual([
      'Hello there.',
      'How are you?',
      'Fine',
    ]);
  });

  it('gives ranges in the text, without the spaces around a sentence', () => {
    expect(splitSentences('  One.   Two.  ', true, Number.POSITIVE_INFINITY)).toEqual([
      { from: 2, to: 6, complete: true },
      { from: 9, to: 13, complete: true },
    ]);
  });

  it('keeps decimals, abbreviations and initials inside their sentence', () => {
    expect(
      said('It costs 3.5 euros, e.g. at the market. Dr. Smith agrees. J. R. R. Tolkien wrote it.'),
    ).toEqual([
      'It costs 3.5 euros, e.g. at the market.',
      'Dr. Smith agrees.',
      'J. R. R. Tolkien wrote it.',
    ]);
    expect(said('Das ist z.B. Nudeln mit Tomaten. Danach d.h. abends?')).toEqual([
      'Das ist z.B. Nudeln mit Tomaten.',
      'Danach d.h. abends?',
    ]);
  });

  it('keeps closing quotes and brackets with their sentence, and an ellipsis ends one', () => {
    expect(said('He said "Yes." Then (quietly!) he left. «Très bien.» Fin… Next.')).toEqual([
      'He said "Yes."',
      'Then (quietly!) he left.',
      '«Très bien.»',
      'Fin…',
      'Next.',
    ]);
  });

  it('waits for what follows a closing mark at the end while it streams', () => {
    expect(said('He said "Yes.', false)).toEqual(['He said "Yes. (open)']);
    expect(said('He said "Yes."', false)).toEqual(['He said "Yes." (open)']);
    expect(said('He said "Yes." T', false)).toEqual(['He said "Yes."', 'T (open)']);
  });

  it('splits Japanese at its full stops, which need no space after them', () => {
    expect(said('棚の上にはパスタが三つあります。オリー', false)).toEqual([
      '棚の上にはパスタが三つあります。',
      'オリー (open)',
    ]);
    expect(said('オリーブオイルも一本！「はい。」どうぞ')).toEqual([
      'オリーブオイルも一本！',
      '「はい。」',
      'どうぞ',
    ]);
  });

  it('gives nothing for what has no letters or digits', () => {
    expect(said('… — ! 🙂. OK.')).toEqual(['OK.']);
    expect(said('   ')).toEqual([]);
  });

  it('maxLength cuts at a comma, else at a space, else anywhere, each part with its range', () => {
    const long = 'First the water boils in a large pot, then the pasta goes in for nine minutes.';
    expect(said(long, true, 50)).toEqual([
      'First the water boils in a large pot,',
      'then the pasta goes in for nine minutes.',
    ]);
    const words = 'one two three four five six seven eight nine ten eleven twelve';
    const parts = said(words, true, 20);
    expect(parts.every((part) => part.length <= 20)).toBe(true);
    expect(parts.join(' ')).toBe(words);
    expect(said('x'.repeat(45), true, 20)).toEqual(['x'.repeat(20), 'x'.repeat(20), 'x'.repeat(5)]);
    expect(said('A short one.', true, 150)).toEqual(['A short one.']);
  });

  it("a streaming sentence's parts before its last are complete", () => {
    const long = 'First the water boils in a large pot, then the pasta goes in';
    expect(said(long, false, 50)).toEqual([
      'First the water boils in a large pot,',
      'then the pasta goes in (open)',
    ]);
  });
});
