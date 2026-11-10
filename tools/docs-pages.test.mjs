import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  anchor,
  blocksMarkdown,
  codeSpan,
  compare,
  indexMarkdown,
  pagePath,
  partMarkdown,
  openingOf,
  removablePage,
  spansMarkdown,
  topicMarkdown,
  webpSize,
} from './docs-pages.mjs';

const text = (t) => ({ kind: 'text', text: t });
const code = (t) => ({ kind: 'code', text: t });
const paragraph = (...spans) => ({ kind: 'paragraph', spans });
const noLinks = () => null;

describe('codeSpan', () => {
  it('fences its text with more backticks than it holds', () => {
    assert.equal(codeSpan('neatButton'), '`neatButton`');
    assert.equal(codeSpan('a`b'), '``a`b``');
    assert.equal(codeSpan('`x`'), '`` `x` ``');
  });
});

describe('spansMarkdown and blocksMarkdown', () => {
  const link = (name, member) =>
    name === 'NeatTone' ? `../components/status-chip.md#${anchor(name)}` : null;

  it('writes text, code, strong text and references, linked where the part has a page', () => {
    const spans = [
      text('A '),
      { kind: 'ref', text: 'NeatTone', name: 'NeatTone' },
      text(' or '),
      { kind: 'ref', text: 'Hidden', name: 'Hidden' },
      { kind: 'text', text: ' always', strong: true },
    ];
    assert.equal(
      spansMarkdown(spans, link),
      'A [`NeatTone`](../components/status-chip.md#neattone) or `Hidden`** always**',
    );
  });

  it('keeps a placeholder in prose as text, not as a tag', () => {
    assert.equal(
      spansMarkdown([text('named "<label>: <value>"'), code('<b>')], noLinks),
      'named "&lt;label>: &lt;value>"`<b>`',
    );
  });

  it('writes paragraphs, lists and fenced code, each line indented', () => {
    const blocks = [
      paragraph(text('One.')),
      { kind: 'list', items: [[text('a')], [code('b')]] },
      { kind: 'code', language: 'html', code: '<a>\n</a>' },
    ];
    assert.equal(
      blocksMarkdown(blocks, noLinks, '  '),
      '  One.\n\n  - a\n  - `b`\n\n  ```html\n  <a>\n  </a>\n  ```',
    );
  });
});

describe('partMarkdown', () => {
  const part = {
    name: 'NeatSwitch',
    kind: 'component',
    selector: 'button[neatSwitch]',
    doc: [paragraph(text('First.')), paragraph(text('Second.'))],
    inputs: [
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        transform: 'booleanAttribute',
        doc: [paragraph(text('Turns it off.'))],
      },
    ],
    models: [{ name: 'checked', type: 'boolean', default: 'false', doc: [] }],
  };

  it('says its kind, entry and selector, its doc, then its members with type and default', () => {
    const markdown = partMarkdown(part, '@sima/neat-ui/switch', noLinks);
    assert.match(markdown, /^### `NeatSwitch`$/m);
    assert.match(
      markdown,
      /^Component from `@sima\/neat-ui\/switch`, selector `button\[neatSwitch\]`\.$/m,
    );
    assert.match(markdown, /^First\.$/m);
    assert.match(
      markdown,
      /^- \*\*`disabled`\*\* `boolean`, default `false`, transform `booleanAttribute`\n\n {2}Turns it off\.$/m,
    );
    assert.match(
      markdown,
      /^\*\*Models \(two-way\)\*\*\n\n- \*\*`checked`\*\* `boolean`, default `false`$/m,
    );
  });

  it('leaves out the first paragraph when the page has already said it', () => {
    const markdown = partMarkdown(part, '@sima/neat-ui/switch', noLinks, {
      skip: 1,
    });
    assert.doesNotMatch(markdown, /First\./);
    assert.match(markdown, /Second\./);
  });

  it('writes a method’s overloads as a block of code under its name', () => {
    const service = {
      name: 'NeatDialog',
      kind: 'service',
      doc: [],
      methods: [
        {
          name: 'open',
          signature: 'open(a: A): R\nopen(b: B): R',
          doc: [paragraph(text('Opens it.'))],
        },
      ],
    };
    assert.match(
      partMarkdown(service, '@sima/neat-ui/dialog', noLinks),
      /\*\*Methods\*\*\n\n- \*\*`open`\*\*\n\n {2}```ts\n {2}open\(a: A\): R\n {2}open\(b: B\): R\n {2}```\n\n {2}Opens it\.$/m,
    );
  });

  it('writes a function’s signature and a type’s definition as code', () => {
    const fn = {
      name: 'neatSecondsAgo',
      kind: 'function',
      signature: 'neatSecondsAgo(ms: number): string',
      doc: [],
    };
    assert.match(
      partMarkdown(fn, '@sima/neat-ui', noLinks),
      /```ts\nneatSecondsAgo\(ms: number\): string\n```/,
    );
    const type = { name: 'NeatTone', kind: 'type', definition: "'neutral' | 'danger'", doc: [] };
    assert.match(
      partMarkdown(type, '@sima/neat-ui', noLinks),
      /```ts\ntype NeatTone = 'neutral' \| 'danger'\n```/,
    );
  });
});

describe('topicMarkdown', () => {
  const part = {
    name: 'NeatSwitch',
    kind: 'component',
    selector: 'button[neatSwitch]',
    doc: [paragraph(text('An on/off switch.')), paragraph(text('More.'))],
  };
  const example = {
    id: 'on-and-off',
    title: 'On and off',
    gallery: true,
    caption: [paragraph(text('Two switches.'))],
    files: [
      {
        name: '1-on-and-off.example.ts',
        code: [
          ['keyword', 'export'],
          ['text', ' class X {}\n'],
        ],
      },
    ],
  };
  const page = (hasPicture) =>
    topicMarkdown({
      topic: { id: 'switch', label: 'Switch', parts: ['NeatSwitch'], leads: ['NeatSwitch'] },
      group: { id: 'components', label: 'Components' },
      category: { id: 'forms', label: 'Forms' },
      examples: [example],
      declared: (name) =>
        name === 'NeatSwitch' ? { part, entryImport: '@sima/neat-ui/switch' } : {},
      link: noLinks,
      pictureWidth: () => (hasPicture ? 300 : 0),
    });

  it('opens with the lead’s first paragraph, its picture and its import', () => {
    const markdown = page(true);
    assert.match(
      markdown,
      /^# Switch\n\n_Components › Forms_ · \[All topics\]\(\.\.\/README\.md\)\n\nAn on\/off switch\.\n\n<picture>/m,
    );
    assert.match(markdown, /```ts\nimport \{ NeatSwitch \} from '@sima\/neat-ui\/switch';\n```/);
  });

  it('shows each example’s caption, picture and folded code, then the API without the opening', () => {
    const markdown = page(true);
    assert.match(markdown, /### On and off\n\nTwo switches\.\n\n<picture>/);
    assert.match(markdown, /alt="Switch: On and off" width="300">/);
    assert.match(
      markdown,
      /<details>\n<summary>Code<\/summary>\n\n`1-on-and-off\.example\.ts`\n\n```ts\nexport class X \{\}\n```\n\n<\/details>/,
    );
    const api = markdown.slice(markdown.indexOf('## API'));
    assert.doesNotMatch(api, /An on\/off switch\./);
    assert.match(api, /More\./);
  });

  it('leaves the pictures out until they are taken', () => {
    assert.doesNotMatch(page(false), /<picture>/);
  });
});

describe('openingOf', () => {
  it('takes the first paragraph, and the usage right after it', () => {
    const use = { kind: 'code', language: 'html', code: '<x />' };
    assert.deepEqual(openingOf([paragraph(text('A thing.')), use, paragraph(text('More.'))]), [
      paragraph(text('A thing.')),
      use,
    ]);
    assert.deepEqual(openingOf([paragraph(text('A thing.')), paragraph(text('More.')), use]), [
      paragraph(text('A thing.')),
    ]);
    assert.deepEqual(openingOf([use]), []);
  });
});

describe('webpSize', () => {
  const riff = (chunk, body) =>
    Buffer.concat([Buffer.from(`RIFF\0\0\0\0WEBP${chunk}`, 'latin1'), body]);

  it('reads the extended, lossy and lossless headers', () => {
    const vp8x = Buffer.alloc(18);
    vp8x.writeUIntLE(1799, 8, 3);
    vp8x.writeUIntLE(899, 11, 3);
    assert.deepEqual(webpSize(riff('VP8X', vp8x)), { width: 1800, height: 900 });
    const vp8 = Buffer.alloc(18);
    vp8.writeUInt16LE(640, 10);
    vp8.writeUInt16LE(360, 12);
    assert.deepEqual(webpSize(riff('VP8 ', vp8)), { width: 640, height: 360 });
    const vp8l = Buffer.alloc(18);
    vp8l.writeUInt32LE(99 | (49 << 14), 5);
    assert.deepEqual(webpSize(riff('VP8L', vp8l)), { width: 100, height: 50 });
  });

  it('says null for what is no WebP', () => {
    assert.equal(webpSize(Buffer.from('not a picture at all, just some text')), null);
  });
});

describe('indexMarkdown and pagePath', () => {
  it('lists the topics by section, linked to their pages', () => {
    const markdown = indexMarkdown([
      { label: 'Forms', topics: [{ label: 'Switch', href: 'components/switch.md' }] },
    ]);
    assert.match(markdown, /^## Forms\n\n- \[Switch\]\(components\/switch\.md\)$/m);
    assert.equal(pagePath('components', 'switch'), 'docs/components/switch.md');
  });
});

// Only the path check is run here, on strings: nothing in these tests removes a file.
describe('removablePage', () => {
  const root = '/repo';

  it('allows a Markdown page directly in a group’s folder under docs/', () => {
    assert.equal(removablePage(root, 'docs/components/old-topic.md'), true);
  });

  it('refuses anything else', () => {
    for (const path of [
      'docs/README.md',
      'docs/writing.md',
      'docs/images/bev/round.light.webp',
      'docs/components',
      'docs/components/sub/old.md',
      'docs/../README.md',
      'docs/components/../../x.md',
      '/etc/passwd.md',
      'README.md',
      '',
      '.',
      undefined,
    ]) {
      assert.equal(removablePage(root, path), false, String(path));
    }
  });
});

describe('the committed docs pages', () => {
  it('match the kit, its examples and the pictures taken', async () => {
    const { changed, extra } = await compare();
    assert.deepEqual({ changed, extra }, { changed: [], extra: [] }, 'run npm run docs:pages');
  });
});
