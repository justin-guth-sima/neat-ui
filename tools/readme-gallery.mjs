/*
 * The README's gallery: one picture per topic, the example marked `@gallery`, grouped as the
 * showcase's rail groups them (Theme, Layout, then Components by category), written into
 * README.md between its two gallery markers. The sections in `LEAD` come first, the rest follow in
 * rail order.
 *
 *   npm run docs:gallery              rewrite the gallery in README.md
 *   npm run docs:gallery -- --check   only check it (npm run test:tools does, so CI does)
 *
 * The topics, their labels and order come from the showcase's `topics.ts` and `docs-routes.ts`,
 * the picks from the examples' class docs (docs:emit reads them), and the pictures from
 * `docs/images`, which `npm run docs:capture -- --gallery` takes. Each picture is light and dark
 * (`<picture>`, so GitHub shows the reader's theme) and links to its topic's docs page
 * (`npm run docs:pages`). A topic without a pick is named on the line under its section, so every
 * topic stays one link away.
 *
 * It fails when a pick has no picture yet: a README with a broken image is worse than one without
 * the topic, and the fix is one capture away.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const README = 'README.md';
export const START =
  '<!-- gallery: written by `npm run docs:gallery` from the @gallery examples -->';
export const END = '<!-- gallery end -->';
export const IMAGES = 'docs/images';
/** Pictures per row: three fit GitHub's column at a size where a component still reads. */
const COLUMNS = 3;

/**
 * The sections that open the gallery, by id: a reader should first see what the kit draws that
 * nothing else does, not the theme's swatches or a page's frame.
 */
export const LEAD = ['charts', 'diagram', 'video'];

/** The sections of the gallery, in rail order: a group's own topics, or each of its categories. */
export function sectionsOf(groups) {
  return groups.flatMap((group) =>
    group.topics
      ? [{ id: group.id, label: group.label, group: group.id, topics: group.topics }]
      : group.categories.map((category) => ({
          id: category.id,
          label: category.label,
          group: group.id,
          topics: category.topics,
        })),
  );
}

/** `sections` with those `lead` names first, in `lead`'s order, and the others as they were. */
export function leading(sections, lead = LEAD) {
  const first = lead.map((id) => sections.find((section) => section.id === id)).filter(Boolean);
  return [...first, ...sections.filter((section) => !lead.includes(section.id))];
}

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Where a topic links: its docs page (`docs/<group>/<topic>.md`, `npm run docs:pages`). */
const pageLink = (group, id) => `docs/${group}/${id}.md`;

/** One cell: the pick's picture in both schemes, linked to its page, with the topic's name. */
function cell(group, topic, example) {
  const picture = (scheme) => `${IMAGES}/${topic.id}/${example.id}.${scheme}.webp`;
  const alt = escape(`${topic.label}: ${example.title}`);
  const link = pageLink(group, topic.id);
  return [
    '<td align="center" valign="top" width="33%">',
    `<a href="${link}"><picture>`,
    `<source media="(prefers-color-scheme: dark)" srcset="${picture('dark')}">`,
    `<img src="${picture('light')}" alt="${alt}">`,
    '</picture></a><br>',
    `<a href="${link}"><b>${escape(topic.label)}</b></a>`,
    '</td>',
  ].join('\n');
}

/**
 * The gallery's Markdown: per section a heading, a table of its picks' pictures and a line naming
 * its other topics; a section with neither is left out. `picks` maps a topic id to its `@gallery`
 * example (`id`, `title`); `hasPage(topic)` tells whether a topic has a docs page to link (a
 * topic generated from the kit, `load`; not a hand-made one such as the theme's tokens).
 */
export function galleryMarkdown({ sections, picks, hasPage = (topic) => Boolean(topic.load) }) {
  const parts = [];
  for (const section of sections) {
    const shown = section.topics.filter((topic) => picks.has(topic.id));
    const others = section.topics.filter((topic) => !picks.has(topic.id));
    if (!shown.length && !others.length) continue;
    parts.push(`### ${section.label}`);
    if (shown.length) {
      const rows = [];
      for (let i = 0; i < shown.length; i += COLUMNS) {
        const cells = shown
          .slice(i, i + COLUMNS)
          .map((topic) => cell(section.group, topic, picks.get(topic.id)));
        rows.push(`<tr>\n${cells.join('\n')}\n</tr>`);
      }
      parts.push(`<table>\n${rows.join('\n')}\n</table>`);
    }
    if (others.length) {
      const names = others.map((topic) =>
        hasPage(topic) ? `[${topic.label}](${pageLink(section.group, topic.id)})` : topic.label,
      );
      parts.push(`${shown.length ? 'Also' : 'In this section'}: ${names.join(', ')}.`);
    }
  }
  return parts.join('\n\n');
}

/** `readme` with the text between its gallery markers replaced by `gallery`. */
export function withGallery(readme, gallery) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start < 0 || end < start) {
    throw new Error(`${README} needs the gallery markers, in order:\n${START}\n${END}`);
  }
  return `${readme.slice(0, start + START.length)}\n\n${gallery}\n\n${readme.slice(end)}`;
}

/** The picks whose pictures are missing from `root`'s images folder, as `topic/example` names. */
export function missingPictures(root, picks) {
  return [...picks]
    .filter(([topic, example]) =>
      ['light', 'dark'].some(
        (scheme) => !existsSync(join(root, IMAGES, topic, `${example.id}.${scheme}.webp`)),
      ),
    )
    .map(([topic, example]) => `${topic}/${example.id}`);
}

/** The README as it should be, the README as it is, and the picks without pictures. */
export async function gallery(root = ROOT) {
  const [{ GROUPS }, { extractExamples }] = await Promise.all([
    import(pathToFileURL(join(root, 'projects/showcase/src/app/docs/topics.ts')).href),
    import('./docs-emit.mjs'),
  ]);
  const { topics } = extractExamples(root);
  const picks = new Map();
  for (const { topic, examples } of topics) {
    const pick = examples.find((example) => example.gallery);
    if (pick) picks.set(topic, pick);
  }
  const markdown = galleryMarkdown({ sections: leading(sectionsOf(GROUPS)), picks });
  const current = readFileSync(join(root, README), 'utf8');
  return { wanted: withGallery(current, markdown), current, missing: missingPictures(root, picks) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const { wanted, current, missing } = await gallery();
  const problems = missing.map(
    (name) => `${name} is @gallery and has no picture: run npm run docs:capture -- --gallery`,
  );
  if (check && wanted !== current) {
    problems.push(`${README}'s gallery is stale: run npm run docs:gallery`);
  } else if (!check && wanted !== current) {
    writeFileSync(join(ROOT, README), wanted);
    console.log(`Wrote the gallery into ${README}.`);
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  if (check) console.log(`${README}'s gallery matches the @gallery examples and their pictures.`);
}
