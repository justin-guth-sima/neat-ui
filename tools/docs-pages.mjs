/*
 * The kit's docs as Markdown, one page per showcase topic, for readers on GitHub: what the topic
 * is, its import, its examples (each a picture in light and dark with its code folded), then its
 * parts' API. `docs/README.md` is the index. Written from the same sources as the showcase (the
 * kit's doc comments, the examples, `topics.ts`), so the two say the same.
 *
 *   npm run docs:pages              write docs/README.md and docs/<group>/<topic>.md
 *   npm run docs:pages -- --check   only check them (npm run test:tools does, so CI does)
 *
 * A page shows an example's picture when `docs/images` has it (`npm run docs:capture`), and only
 * its caption and code when not: pictures are retaken at a release, the text on every change, so
 * a new example is never blocked on a picture. An `@animated` example's animation, when taken too,
 * stands in for the picture but for readers who asked for reduced motion (`pictureSources`).
 * Hand-made topics (the theme's tokens) have no page.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const DOCS = 'docs';
export const IMAGES = 'docs/images';
/** The pixel ratio the pictures are taken at (`docs:capture`): an image shows at its width / DPR. */
export const PICTURE_DPR = 2;
const HEADER =
  '<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->';

/** Where a topic's page is, from the root: `docs/<group>/<topic>.md`. */
export const pagePath = (group, topic) => `${DOCS}/${group}/${topic}.md`;

// --- pictures -----------------------------------------------------------------------------------

/**
 * A WebP file's width and height in pixels, from its header: the extended (`VP8X`), lossy
 * (`VP8 `) and lossless (`VP8L`) forms; null for anything else.
 */
export function webpSize(bytes) {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (bytes.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

// --- doc comments as Markdown ---------------------------------------------------------------------

/** A code span that holds its text whatever backticks are in it. */
export function codeSpan(text) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** Running text as Markdown; `link(name, member)` gives a part's address, or null. */
export function spansMarkdown(spans, link) {
  return spans
    .map((span) => {
      // Prose names placeholders as `<label>`, which GitHub would take for an unknown tag and drop.
      let text = span.kind === 'text' ? span.text.replace(/</g, '&lt;') : codeSpan(span.text);
      if (span.kind === 'ref') {
        const href = link(span.name, span.member);
        if (href) text = `[${text}](${href})`;
      }
      return span.strong ? `**${text}**` : text;
    })
    .join('');
}

/** Doc blocks as Markdown paragraphs, fenced code and lists, `indent` before every line. */
export function blocksMarkdown(blocks, link, indent = '') {
  const pad = (text) =>
    text
      .split('\n')
      .map((line) => (line ? indent + line : line))
      .join('\n');
  return blocks
    .map((block) => {
      if (block.kind === 'paragraph') return pad(spansMarkdown(block.spans, link));
      if (block.kind === 'list') {
        return pad(block.items.map((item) => `- ${spansMarkdown(item, link)}`).join('\n'));
      }
      return pad(`\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\``);
    })
    .join('\n\n');
}

// --- a topic's page -------------------------------------------------------------------------------

/** The heading anchor GitHub gives `## \`Name\``. */
export const anchor = (name) => name.toLowerCase().replace(/[^a-z0-9_-]/g, '');

/** An example's file in `docs/images`, from `<topic>/<example>`: its still or its animation. */
export const pictureFile = (name, scheme, animated = false) =>
  `${name}.${scheme}${animated ? '.animated' : ''}.webp`;

/**
 * The sources of an example's `<picture>` and its `img`'s file, as GitHub shows the reader's
 * scheme; `src` is `<folder>/<topic>/<example>`. With `animated`, the animation for every reader
 * but one who asked for reduced motion, who gets the still: the first source that matches wins.
 * The README's gallery builds its cells from these too.
 */
export function pictureSources(src, animated = false) {
  const sources = animated
    ? [
        `<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="${pictureFile(src, 'dark')}">`,
        `<source media="(prefers-reduced-motion: reduce)" srcset="${pictureFile(src, 'light')}">`,
      ]
    : [];
  sources.push(
    `<source media="(prefers-color-scheme: dark)" srcset="${pictureFile(src, 'dark', animated)}">`,
  );
  return { sources, img: pictureFile(src, 'light', animated) };
}

/**
 * A picture in both schemes, as GitHub shows the reader's (`pictureSources`), at `width` CSS px
 * (the still's pixel width over the pixel ratio, which the animation is taken at too), since
 * GitHub draws an image at its pixel width and a 2× picture would show twice its size.
 */
const picture = (src, alt, { width, animated }) => {
  const { sources, img } = pictureSources(src, animated);
  return [
    '<picture>',
    ...sources,
    `<img src="${img}" alt="${alt.replace(/"/g, '&quot;')}" width="${width}">`,
    '</picture>',
  ].join('\n');
};

const KIND_WORDS = {
  component: 'Component',
  directive: 'Directive',
  structural: 'Structural directive',
  template: 'Template directive',
  service: 'Service',
  class: 'Class',
  function: 'Function',
  const: 'Constant',
  type: 'Type',
  interface: 'Interface',
  reexport: 'Package',
};

/** A member as a list item: its name, its type, its default, then its doc indented under it. */
function memberMarkdown(member, link) {
  const facts = [codeSpan(member.type)];
  if (member.required) facts.push('required');
  if (member.optional) facts.push('optional');
  if (member.default !== undefined) facts.push(`default ${codeSpan(member.default)}`);
  if (member.transform) facts.push(`transform ${codeSpan(member.transform)}`);
  const head = `- **${codeSpan(member.name)}** ${facts.join(', ')}`;
  const deprecated = member.deprecated?.length
    ? `\n\n  **Deprecated.** ${blocksMarkdown(member.deprecated, link).replace(/\n/g, '\n  ')}`
    : '';
  const doc = member.doc.length ? `\n\n${blocksMarkdown(member.doc, link, '  ')}` : '';
  return head + deprecated + doc;
}

const GROUPS_OF_MEMBERS = [
  ['inputs', 'Inputs'],
  ['models', 'Models (two-way)'],
  ['outputs', 'Outputs'],
  ['context', 'Template context'],
  ['properties', 'Properties'],
  ['members', 'Members'],
];

/** One part's section: its kind and selector or signature, its doc, then its members. */
export function partMarkdown(part, entryImport, link, { skip = 0 } = {}) {
  const lines = [`### ${codeSpan(part.name)}`];
  const facts = [`${KIND_WORDS[part.kind] ?? part.kind} from ${codeSpan(entryImport)}`];
  if (part.selector) facts.push(`selector ${codeSpan(part.selector)}`);
  if (part.exportAs) facts.push(`exported as ${codeSpan(part.exportAs)}`);
  lines.push(`${facts.join(', ')}.`);
  if (part.deprecated?.length)
    lines.push(`**Deprecated.** ${blocksMarkdown(part.deprecated, link)}`);
  const doc = part.doc.slice(skip);
  if (doc.length) lines.push(blocksMarkdown(doc, link));
  const signature =
    part.kind === 'function'
      ? part.signature
      : part.kind === 'const'
        ? `const ${part.name}: ${part.type}`
        : part.kind === 'type'
          ? `type ${part.name}${part.typeParameters ? `<${part.typeParameters.join(', ')}>` : ''} = ${part.definition ?? part.type ?? ''}`
          : null;
  if (signature) lines.push(`\`\`\`ts\n${signature}\n\`\`\``);
  for (const [key, title] of GROUPS_OF_MEMBERS) {
    const members = part[key];
    if (members?.length) {
      lines.push(
        `**${title}**`,
        members.map((member) => memberMarkdown(member, link)).join('\n\n'),
      );
    }
  }
  if (part.methods?.length) {
    // A signature is one line per overload, so it is a block of code under the method's name.
    const methods = part.methods.map((method) => {
      const signature = blocksMarkdown(
        [{ kind: 'code', language: 'ts', code: method.signature }],
        link,
        '  ',
      );
      const doc = method.doc.length ? `\n\n${blocksMarkdown(method.doc, link, '  ')}` : '';
      return `- **${codeSpan(method.name)}**\n\n${signature}${doc}`;
    });
    lines.push('**Methods**', methods.join('\n\n'));
  }
  return lines.join('\n\n');
}

/** An example: its title, caption, picture (when taken) and its files' code, folded. */
function exampleMarkdown({ topic, example, link, imagesFrom, pictureOf }) {
  const lines = [`### ${example.title}`];
  if (example.caption.length) lines.push(blocksMarkdown(example.caption, link));
  if (example.page) lines.push('_This example needs a page of its own: it runs in the showcase._');
  const taken = pictureOf(topic.id, example.id);
  if (taken) {
    const alt = `${topic.label}: ${example.title}`;
    lines.push(picture(`${imagesFrom}/${topic.id}/${example.id}`, alt, taken));
  }
  const files = example.files.map((file) => {
    const language = file.name.endsWith('.css') ? 'css' : 'ts';
    const code = file.code.map(([, text]) => text).join('');
    return `${codeSpan(file.name)}\n\n\`\`\`${language}\n${code.replace(/\n$/, '')}\n\`\`\``;
  });
  lines.push(`<details>\n<summary>Code</summary>\n\n${files.join('\n\n')}\n\n</details>`);
  return lines.join('\n\n');
}

/**
 * What a page opens with from its lead part's doc: the first paragraph, and the code block right
 * after it, the shortest usage the writing guide puts there. The part's own section leaves them
 * out, so they are said once.
 */
export function openingOf(doc) {
  const [first, second] = doc;
  if (first?.kind !== 'paragraph') return [];
  return second?.kind === 'code' ? [first, second] : [first];
}

/**
 * A topic's page. `topic` is its config (label, parts, leads); `declared(name)` gives a part's
 * declaration and its entry's import path; `examples` are the topic's, as docs:emit reads them;
 * `pictureOf(topic, example)` is a taken picture's `width` in CSS px and whether its animation is
 * taken too (`animated`), or null when there is none.
 */
export function topicMarkdown({ topic, group, category, examples, declared, link, pictureOf }) {
  const imagesFrom = '../images';
  const lines = [HEADER, `# ${topic.label}`];
  const where = category ? `${group.label} › ${category.label}` : group.label;
  lines.push(`_${where}_ · [All topics](../README.md)`);
  const parts = topic.parts.map((name) => ({ name, ...declared(name) })).filter((p) => p.part);
  const lead = parts.find((p) => topic.leads.includes(p.name));
  const opening = openingOf(lead?.part.doc ?? []);
  if (opening.length) lines.push(blocksMarkdown(opening, link));
  const shown =
    examples.find((e) => e.gallery && pictureOf(topic.id, e.id)) ??
    examples.find((e) => pictureOf(topic.id, e.id));
  if (shown) {
    const alt = `${topic.label}: ${shown.title}`;
    const taken = pictureOf(topic.id, shown.id);
    lines.push(picture(`${imagesFrom}/${topic.id}/${shown.id}`, alt, taken));
  }
  // The import of what a template or code uses; types come with them as the code needs them.
  const imports = new Map();
  for (const { name, part, entryImport } of parts) {
    if (['type', 'interface', 'reexport'].includes(part.kind)) continue;
    imports.set(entryImport, [...(imports.get(entryImport) ?? []), name]);
  }
  if (imports.size) {
    const statements = [...imports].map(
      ([from, names]) => `import { ${names.join(', ')} } from '${from}';`,
    );
    lines.push(`\`\`\`ts\n${statements.join('\n')}\n\`\`\``);
  }
  if (examples.length) {
    lines.push('## Examples');
    for (const example of examples) {
      lines.push(exampleMarkdown({ topic, example, link, imagesFrom, pictureOf }));
    }
  }
  if (parts.length) {
    lines.push('## API');
    const ordered = [...parts].sort(
      (a, b) => Number(!topic.leads.includes(a.name)) - Number(!topic.leads.includes(b.name)),
    );
    for (const { part, entryImport } of ordered) {
      const skip = part === lead?.part ? opening.length : 0;
      lines.push(partMarkdown(part, entryImport, link, { skip }));
    }
  }
  return `${lines.join('\n\n')}\n`;
}

/** The index: every topic with a page, by section, linked. */
export function indexMarkdown(sections) {
  const lines = [
    HEADER,
    '# neat-ui docs',
    "One page per topic of the kit: what it is, its examples with their code, and its API. The same as the showcase's, which runs the examples live (`npm start`).",
    'For how to write for the kit, see [writing.md](writing.md); for its words, [glossary.md](glossary.md).',
  ];
  for (const { label, topics } of sections) {
    lines.push(`## ${label}`);
    lines.push(topics.map(({ label: name, href }) => `- [${name}](${href})`).join('\n'));
  }
  return `${lines.join('\n\n')}\n`;
}

// --- the whole docs ---------------------------------------------------------------------------------

/** The pages to write, by path from the root, from the showcase's topics and the kit's sources. */
export async function pages(root = ROOT) {
  const [{ GROUPS }, { extractKit, extractExamples }] = await Promise.all([
    import(pathToFileURL(join(root, 'projects/showcase/src/app/docs/topics.ts')).href),
    import('./docs-emit.mjs'),
  ]);
  const kit = extractKit(root);
  const examplesOf = new Map(
    extractExamples(root, kit).topics.map(({ topic, examples }) => [topic, examples]),
  );
  const declaredParts = new Map();
  for (const entry of kit.entries) {
    for (const part of entry.parts) {
      if (part.kind === 'reexport' && !part.package) continue;
      declaredParts.set(part.name, { part, entryImport: entry.import });
    }
  }
  const declared = (name) => declaredParts.get(name) ?? {};

  // Every page, so a part's name links to the page that documents it.
  const placed = [];
  for (const group of GROUPS) {
    const each = group.topics
      ? group.topics.map((topic) => ({ topic, group }))
      : group.categories.flatMap((category) =>
          category.topics.map((topic) => ({ topic, group, category })),
        );
    placed.push(...each.filter(({ topic }) => topic.load));
  }
  const pageOf = new Map();
  for (const { topic, group } of placed) {
    for (const name of topic.parts) pageOf.set(name, `../${group.id}/${topic.id}.md`);
  }
  const link = (name, member) => {
    const page = pageOf.get(name);
    return page ? `${page}#${anchor(name)}` : null;
  };
  // A picture's width in CSS px when both schemes are taken, and whether both schemes of its
  // animation are, else null (the page shows none). A taken animation needs its still, which is
  // its reduced-motion fallback and gives its width.
  const pictureOf = (topic, example) => {
    const file = (scheme, animated) =>
      join(root, IMAGES, pictureFile(`${topic}/${example}`, scheme, animated));
    const both = (animated) =>
      existsSync(file('light', animated)) && existsSync(file('dark', animated));
    if (!both(false)) return null;
    const size = webpSize(readFileSync(file('light', false)));
    return size ? { width: Math.round(size.width / PICTURE_DPR), animated: both(true) } : null;
  };

  const files = new Map();
  for (const { topic, group, category } of placed) {
    const examples = (examplesOf.get(topic.id) ?? []).filter((e) => e.component || e.files.length);
    files.set(
      pagePath(group.id, topic.id),
      topicMarkdown({ topic, group, category, examples, declared, link, pictureOf }),
    );
  }
  const sections = GROUPS.flatMap((group) =>
    group.topics
      ? [{ label: group.label, topics: group.topics }]
      : group.categories.map((category) => ({ label: category.label, topics: category.topics })),
  ).map(({ label, topics }) => ({
    label,
    topics: topics
      .filter((topic) => topic.load)
      .map((topic) => ({
        label: topic.label,
        href: pagePath(placed.find((p) => p.topic === topic).group.id, topic.id).slice(
          DOCS.length + 1,
        ),
      })),
  }));
  files.set(`${DOCS}/README.md`, indexMarkdown(sections.filter(({ topics }) => topics.length)));
  return files;
}

/** The page files now under `docs/<group>/`, by path from the root (the groups' folders only). */
function present(root, groups) {
  return groups.flatMap((group) => {
    const dir = join(root, DOCS, group);
    return existsSync(dir)
      ? readdirSync(dir)
          .filter((name) => name.endsWith('.md'))
          .map((name) => `${DOCS}/${group}/${name}`)
      : [];
  });
}

/**
 * Whether `path` (from the root) is a page this tool may remove: a Markdown file directly in a
 * group's folder under `docs/` (`docs/components/old-topic.md`), by a plain name, never anything
 * else (a folder, an image, the writing guide), and inside `root` once resolved.
 */
export function removablePage(root, path) {
  if (typeof path !== 'string' || !/^docs\/[a-z][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\.md$/.test(path)) {
    return false;
  }
  const base = resolve(root, DOCS);
  const file = resolve(root, path);
  return file.startsWith(base + '/') && dirname(dirname(file)) === base;
}

/** What differs between the pages wanted and those on disk: stale, missing and extra files. */
export async function compare(root = ROOT) {
  const wanted = await pages(root);
  const groups = [
    ...new Set(
      [...wanted.keys()].map((path) => path.split('/')[1]).filter((g) => !g.endsWith('.md')),
    ),
  ];
  const changed = [...wanted]
    .filter(
      ([path, text]) =>
        !existsSync(join(root, path)) || readFileSync(join(root, path), 'utf8') !== text,
    )
    .map(([path]) => path);
  const extra = present(root, groups).filter((path) => !wanted.has(path));
  return { wanted, changed, extra };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { wanted, changed, extra } = await compare();
  if (process.argv.includes('--check')) {
    const problems = [
      ...changed.map((path) => `${path} is stale or missing`),
      ...extra.map((path) => `${path} is no topic's page`),
    ];
    if (problems.length) {
      console.error(`${problems.join('\n')}\nRun npm run docs:pages.`);
      process.exit(1);
    }
    console.log(`The ${wanted.size} docs pages match the kit and its examples.`);
  } else {
    for (const path of changed) {
      mkdirSync(dirname(join(ROOT, path)), { recursive: true });
      writeFileSync(join(ROOT, path), wanted.get(path));
      console.log(`wrote ${path}`);
    }
    // A page of a topic that is gone; only `.md` files in the groups' own folders, never images.
    for (const path of extra) {
      if (!removablePage(ROOT, path)) throw new Error(`refusing to remove ${path}`);
      rmSync(join(ROOT, path));
      console.log(`removed ${path}`);
    }
  }
}
