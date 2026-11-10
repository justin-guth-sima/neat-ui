import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { britishIn } from './spelling.mjs';

/** The text files git tracks, as the repo's spelling covers them. */
const TEXT = /\.(ts|html|css|mjs|js|md|json|ya?ml|txt)$/;

test('finds British stems inside words, and the whole words whose stems are nouns', () => {
  const found = britishIn('a.ts', 'const staticColours = 1;\n// centred, then analysed\n');
  assert.deepEqual(
    found.map(({ word, line, american }) => [word, line, american]),
    [
      ['staticColours', 1, 'color'],
      ['centred', 2, 'centered'],
      ['analysed', 2, 'analyzed'],
    ],
  );
});

test('leaves alone nouns, HTML spelling and the deprecated aliases', () => {
  const text =
    'synthesis, analysis, analyses, emphasis, promise, otherwise\n' +
    '[aria-labelledby]="id" neatLabelColour\n';
  assert.deepEqual(britishIn('a.ts', text), []);
  assert.deepEqual(britishIn('b.ts', 'readonly colours = input({});'), [
    { path: 'b.ts', line: 1, word: 'colours', american: 'color' },
  ]);
  assert.deepEqual(
    britishIn('projects/neat-ui/diagram/src/lib/messages/messages.ts', 'readonly colours'),
    [],
  );
});

test('the repo is spelled in American English (docs/writing.md)', () => {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter((path) => TEXT.test(path) && !path.endsWith('package-lock.json'));
  const found = files.flatMap((path) => {
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      return [];
    }
    return britishIn(path, text);
  });
  const said = found.map(
    ({ path, line, word, american }) => `${path}:${line} ${word} (${american})`,
  );
  assert.deepEqual(said, []);
});
