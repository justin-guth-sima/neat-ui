/*
 * The repo's Markdown links stay whole: every relative link and picture in the README, the guides
 * and the generated docs pages names a file that exists, and every `#anchor` into a Markdown file
 * names one of its headings. Run by `npm run test:tools`, so a renamed topic, part or heading
 * fails there and not on a reader's click.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

/** The Markdown files checked, from the root: the front door, the guides and `docs/`. */
export function markdownFiles(root) {
  const docs = readdirSync(join(root, 'docs'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(root.length + 1)
        .split('\\')
        .join('/'),
    );
  return ['README.md', 'CONTRIBUTING.md', 'AGENTS.md', ...docs.sort()];
}

/** Text without its fenced code, where a `](` or `href` is code, not a link. */
const prose = (markdown) => markdown.replace(/^\s*```[\s\S]*?^\s*```/gm, '');

/** The anchors GitHub gives a file's headings: lower case, punctuation gone, spaces as hyphens. */
export function anchorsOf(markdown) {
  const seen = new Map();
  const anchors = new Set();
  for (const [, heading] of prose(markdown).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = heading
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_\- ]/gu, '')
      .replace(/ /g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count ? `${base}-${count}` : base);
  }
  return anchors;
}

/** The relative links of a file: Markdown links and the `href`, `src` and `srcset` of its HTML. */
export function linksOf(markdown) {
  const links = [];
  for (const match of prose(markdown).matchAll(/\]\(([^)\s]+)\)|(?:href|src|srcset)="([^"]+)"/g)) {
    const link = match[1] ?? match[2];
    if (!/^(?:[a-z]+:|#$)/i.test(link)) links.push(link);
  }
  return links;
}

/** Every broken link of `files` (from `root`), as `file: link (why)`. */
export function brokenLinks(root, files = markdownFiles(root)) {
  const anchorCache = new Map();
  const broken = [];
  for (const file of files) {
    for (const link of linksOf(readFileSync(join(root, file), 'utf8'))) {
      const [path, anchor] = link.split('#');
      const target = path ? normalize(join(dirname(file), path)) : file;
      if (!existsSync(join(root, target))) {
        broken.push(`${file}: ${link} (no such file)`);
      } else if (anchor && target.endsWith('.md')) {
        if (!anchorCache.has(target)) {
          anchorCache.set(target, anchorsOf(readFileSync(join(root, target), 'utf8')));
        }
        if (!anchorCache.get(target).has(anchor)) broken.push(`${file}: ${link} (no such heading)`);
      }
    }
  }
  return broken;
}
