import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  END,
  IMAGES,
  START,
  gallery,
  galleryMarkdown,
  missingPictures,
  sectionsOf,
  withGallery,
} from './readme-gallery.mjs';

const topic = (id, label) => ({ id, label });

describe('sectionsOf', () => {
  it('takes a group’s own topics as one section, and a group with categories as one each', () => {
    const groups = [
      { label: 'Theme', topics: [topic('colors', 'Colors')] },
      {
        label: 'Components',
        categories: [
          { label: 'Actions', topics: [topic('button', 'Button')] },
          { label: 'Forms', topics: [topic('switch', 'Switch')] },
        ],
      },
    ];
    assert.deepEqual(
      sectionsOf(groups).map((section) => [section.label, section.topics.map((t) => t.id)]),
      [
        ['Theme', ['colors']],
        ['Actions', ['button']],
        ['Forms', ['switch']],
      ],
    );
  });
});

describe('galleryMarkdown', () => {
  const sections = [
    {
      label: 'Actions',
      topics: [
        topic('button', 'Button'),
        topic('toast', 'Toast'),
        topic('tooltip', 'Tooltip'),
        topic('popover', 'Popover'),
        topic('motion', 'Motion'),
      ],
    },
    { label: 'Theme', topics: [topic('tokens', 'Tokens')] },
  ];
  const picks = new Map([
    ['button', { id: 'variants', title: 'Variants' }],
    ['toast', { id: 'kinds', title: 'Kinds' }],
    ['tooltip', { id: 'positions', title: 'Positions' }],
    ['popover', { id: 'menu', title: 'Menu & more' }],
  ]);
  const text = galleryMarkdown({ sections, picks, hasExamples: (id) => id !== 'tokens' });

  it('shows each pick in both schemes, linked to its topic, three to a row', () => {
    assert.match(text, /^### Actions$/m);
    assert.equal(text.match(/<tr>/g).length, 2);
    assert.match(
      text,
      /<source media="\(prefers-color-scheme: dark\)" srcset="docs\/images\/button\/variants\.dark\.webp">/,
    );
    assert.match(
      text,
      /<img src="docs\/images\/button\/variants\.light\.webp" alt="Button: Variants">/,
    );
    assert.match(
      text,
      /<a href="projects\/showcase\/src\/app\/examples\/button\/"><b>Button<\/b><\/a>/,
    );
    assert.match(text, /alt="Popover: Menu &amp; more"/);
  });

  it('names the topics without a pick under their section, linked where they have examples', () => {
    assert.match(text, /^Also: \[Motion\]\(projects\/showcase\/src\/app\/examples\/motion\/\)\.$/m);
    assert.match(text, /^### Theme\n\nIn this section: Tokens\.$/m);
  });
});

describe('withGallery', () => {
  it('replaces what lies between the markers, and keeps the rest', () => {
    const readme = `# Kit\n\n${START}\nold\n${END}\n\n## After\n`;
    assert.equal(withGallery(readme, 'new'), `# Kit\n\n${START}\n\nnew\n\n${END}\n\n## After\n`);
  });

  it('refuses a README without its markers', () => {
    assert.throws(() => withGallery('# Kit\n', 'new'), /gallery markers/);
    assert.throws(() => withGallery(`${END}\n${START}\n`, 'new'), /gallery markers/);
  });
});

describe('missingPictures', () => {
  it('names the picks that lack a light or a dark picture', () => {
    const root = mkdtempSync(join(tmpdir(), 'readme-gallery-'));
    try {
      mkdirSync(join(root, IMAGES, 'button'), { recursive: true });
      writeFileSync(join(root, IMAGES, 'button', 'variants.light.webp'), '');
      writeFileSync(join(root, IMAGES, 'button', 'variants.dark.webp'), '');
      writeFileSync(join(root, IMAGES, 'button', 'states.light.webp'), '');
      const picks = new Map([
        ['button', { id: 'variants' }],
        ['toast', { id: 'kinds' }],
      ]);
      assert.deepEqual(missingPictures(root, picks), ['toast/kinds']);
    } finally {
      rmSync(root, { recursive: true });
    }
  });
});

describe('the committed README', () => {
  it('has the gallery of the @gallery examples, and a picture for each', async () => {
    const { wanted, current, missing } = await gallery();
    assert.deepEqual(missing, [], 'run npm run docs:capture -- --gallery');
    assert.ok(wanted === current, 'README.md’s gallery is stale: run npm run docs:gallery');
  });
});
