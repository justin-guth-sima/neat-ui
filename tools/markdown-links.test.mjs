import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { anchorsOf, brokenLinks, linksOf } from './markdown-links.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');

describe('anchorsOf', () => {
  it('gives GitHub’s anchors: lower case, punctuation gone, repeats numbered', () => {
    const markdown = [
      '# Contributing to neat-ui',
      '### `NeatButton`',
      "## How the kit is built on Spartan's helm",
      '## Examples',
      '## Examples',
      '```md',
      '# Not a heading',
      '```',
    ].join('\n');
    assert.deepEqual(
      [...anchorsOf(markdown)],
      [
        'contributing-to-neat-ui',
        'neatbutton',
        'how-the-kit-is-built-on-spartans-helm',
        'examples',
        'examples-1',
      ],
    );
  });
});

describe('linksOf', () => {
  it('finds relative links and pictures, not web links or code', () => {
    const markdown = [
      'See [the guide](docs/writing.md#words) and [GitHub](https://github.com).',
      '<img src="docs/images/a.light.webp"> <source srcset="docs/images/a.dark.webp">',
      '```ts',
      "const x = '[not](a-link.md)';",
      '```',
    ].join('\n');
    assert.deepEqual(linksOf(markdown), [
      'docs/writing.md#words',
      'docs/images/a.light.webp',
      'docs/images/a.dark.webp',
    ]);
  });
});

describe('the repo’s Markdown', () => {
  it('links only to files and headings that exist', () => {
    assert.deepEqual(brokenLinks(ROOT), []);
  });
});
