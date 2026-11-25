import { describe, expect, it } from 'vitest';
import { neatSpeakable, type NeatSpeakableSentence } from './speakable';

/** Each sentence's words, and `(open)` after one that is not complete. */
const said = (sentences: readonly NeatSpeakableSentence[]) =>
  sentences.map((sentence) => sentence.text + (sentence.complete ? '' : ' (open)'));

/** A reply as a model writes one: prose, a list, a fence, a table, a quote. */
const REPLY =
  '## Pasta al pomodoro\n\n' +
  'Three jars of **dried pasta**, a bottle of *olive oil* and canned tomatoes. Together that is ' +
  'most of a [pasta al pomodoro](https://en.wikipedia.org/wiki/Pasta_al_pomodoro).\n\n' +
  '1. Boil the pasta for 9 min.\n2. Warm the oil, e.g. with garlic. Then add `tomatoes`.\n\n' +
  '```python\nprint("Not read. Ever.")\n```\n\n' +
  '| Item | Count |\n|---|---|\n| Jars | 3 |\n\n' +
  '> Tip: salt the water! It matters.\n\nEnjoy… Bon appétit.';

describe('neatSpeakable', () => {
  it('"**Hello.** World." gives "Hello." at 2–8 and "World." at 11–17', () => {
    expect(neatSpeakable('**Hello.** World.')).toEqual([
      { text: 'Hello.', from: 2, to: 8, complete: true },
      { text: 'World.', from: 11, to: 17, complete: true },
    ]);
  });

  it('never reads code; reads inline code', () => {
    const text = 'Run this:\n\n```python\nprint("Hi. There.")\n```\n\nThen call `main()` once.';
    expect(said(neatSpeakable(text))).toEqual(['Run this:', 'Then call main() once.']);
    const streaming = 'Look.\n\n```sh\nls -la. more';
    expect(said(neatSpeakable(streaming, { final: false }))).toEqual(['Look.']);
  });

  it('reads a whole reply in order: headings and list items are sentences of their own', () => {
    expect(said(neatSpeakable(REPLY))).toEqual([
      'Pasta al pomodoro',
      'Three jars of dried pasta, a bottle of olive oil and canned tomatoes.',
      'Together that is most of a pasta al pomodoro.',
      'Boil the pasta for 9 min.',
      'Warm the oil, e.g. with garlic.',
      'Then add tomatoes.',
      'Tip: salt the water!',
      'It matters.',
      'Enjoy…',
      'Bon appétit.',
    ]);
    for (const sentence of neatSpeakable(REPLY)) {
      expect(sentence.text.replace(/[`*]/g, '').length).toBeGreaterThan(0);
      expect(REPLY.slice(sentence.from, sentence.to).length).toBeGreaterThanOrEqual(
        sentence.text.length,
      );
    }
  });

  it('a streaming text’s last sentence is incomplete until whitespace or another block follows', () => {
    expect(said(neatSpeakable('Hello there', { final: false }))).toEqual(['Hello there (open)']);
    expect(said(neatSpeakable('Hello there.', { final: false }))).toEqual(['Hello there. (open)']);
    expect(said(neatSpeakable('Hello there. How', { final: false }))).toEqual([
      'Hello there.',
      'How (open)',
    ]);
    expect(said(neatSpeakable('Hello there\n\nNext', { final: false }))).toEqual([
      'Hello there',
      'Next (open)',
    ]);
    expect(said(neatSpeakable('Hello there'))).toEqual(['Hello there']);
  });

  it('a paragraph before a streaming code fence is complete', () => {
    expect(said(neatSpeakable('Like this\n\n```py\nx = 1', { final: false }))).toEqual([
      'Like this',
    ]);
  });

  it('line breaks are spaces in what is spoken', () => {
    expect(said(neatSpeakable('One line\nand the next.  \nA break'))).toEqual([
      'One line and the next.',
      'A break',
    ]);
  });

  it('every complete sentence of a prefix keeps its range in the whole text', () => {
    const whole = neatSpeakable(REPLY);
    const key = (sentence: NeatSpeakableSentence) =>
      `${sentence.from}-${sentence.to}:${sentence.text}`;
    const keys = new Set(whole.map(key));
    for (let i = 1; i <= REPLY.length; i++) {
      for (const sentence of neatSpeakable(REPLY.slice(0, i), { final: false })) {
        if (sentence.complete) expect(keys, `prefix ${i}`).toContain(key(sentence));
      }
    }
  });

  it('maxLength cuts at a comma, else a space, each part with its own range', () => {
    const text =
      'First the water boils in a large pot, then the pasta goes in for nine minutes. Done.';
    const parts = neatSpeakable(text, { maxLength: 50 });
    expect(said(parts)).toEqual([
      'First the water boils in a large pot,',
      'then the pasta goes in for nine minutes.',
      'Done.',
    ]);
    for (const part of parts) expect(text.slice(part.from, part.to)).toBe(part.text);
  });

  it('Japanese: 棚の上に…。オリーブ…。 gives two sentences', () => {
    const text = '棚の上にはパスタが三つあります。オリーブオイルも一本あります。';
    expect(said(neatSpeakable(text))).toEqual([
      '棚の上にはパスタが三つあります。',
      'オリーブオイルも一本あります。',
    ]);
    const [first, second] = neatSpeakable(text);
    expect([first.from, first.to, second.from, second.to]).toEqual([0, 16, 16, 31]);
  });

  it('gives nothing for an empty text or one with no words', () => {
    expect(neatSpeakable('')).toEqual([]);
    expect(neatSpeakable('```\ncode\n```')).toEqual([]);
    expect(neatSpeakable('---')).toEqual([]);
  });
});
