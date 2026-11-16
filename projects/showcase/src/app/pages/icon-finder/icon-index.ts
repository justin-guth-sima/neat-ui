import { NEAT_ICON_NAMES, type NeatIconGlyph, type NeatIconName } from '@sima/neat-ui';
// Lucide's own data rather than the lucide entry: importing every glyph from `lucide` would put
// them all into the showcase's first chunk, beside the few the kit's icon registry imports.
import lucideDrawings from 'lucide-static/icon-nodes.json';
import lucideTags from 'lucide-static/tags.json';
import { ICON_GLYPHS, LUCIDE_ALIASES } from '../../docs/generated/icon-glyphs';

/** A Lucide glyph: its canonical name, the other names it is exported by, and its tags. */
export interface LucideGlyph {
  readonly kind: 'lucide';
  /** The finder's id for it, `lucide:<Name>`, the `icon` query parameter that selects it. */
  readonly id: string;
  /** The canonical name, as `@sima/neat-ui/lucide` exports it (`Trash`). */
  readonly name: string;
  /** The other names it is exported by (`Trash2`). */
  readonly aliases: readonly string[];
  readonly drawing: NeatIconGlyph;
  /** Lucide's words for what it shows ("delete", "bin"). */
  readonly tags: readonly string[];
  /** The kit's names that draw it, which an app takes instead (the icon rule). */
  readonly kitNames: readonly NeatIconName[];
}

/** A name of the kit's icon set, and the Lucide glyph it draws. */
export interface KitIcon {
  readonly kind: 'kit';
  /** The finder's id for it, `kit:<name>`. */
  readonly id: string;
  readonly name: NeatIconName;
  readonly glyph: LucideGlyph;
}

export type FinderIcon = KitIcon | LucideGlyph;

/** Every icon an app can use: the kit's names and Lucide's glyphs. */
export interface IconIndex {
  readonly kit: readonly KitIcon[];
  readonly lucide: readonly LucideGlyph[];
  readonly byId: ReadonlyMap<string, FinderIcon>;
}

/** Lucide's file name of a glyph (`trash-2`) as the name its packages export it by (`Trash2`). */
export function pascalName(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** What the index is built from, by Lucide's file name of each glyph (`trash-2`). */
export interface IconSources {
  /** Each glyph's drawing (`lucide-static`'s icon-nodes.json, the same as `lucide` exports). */
  readonly drawings: Readonly<Record<string, NeatIconGlyph>>;
  /** Each glyph's tags (`lucide-static`'s tags.json). */
  readonly tags: Readonly<Record<string, readonly string[]>>;
  /** The other names `@sima/neat-ui/lucide` exports a glyph by (`docs:emit`'s table). */
  readonly aliases: Readonly<Record<string, readonly string[]>>;
  /** The kit's names, in the registry's order. */
  readonly kitNames: readonly NeatIconName[];
  /** The glyph each kit name draws, by file name (`docs:emit`'s table, from the registry). */
  readonly glyphs: Readonly<Record<NeatIconName, string>>;
}

/** Builds the index: every glyph once, by the name it is exported by, then the kit's names. */
export function buildIconIndex(sources: IconSources): IconIndex {
  const kitByFile = new Map<string, NeatIconName[]>();
  for (const name of sources.kitNames) {
    const file = sources.glyphs[name];
    kitByFile.set(file, [...(kitByFile.get(file) ?? []), name]);
  }
  const byFile = new Map<string, LucideGlyph>();
  for (const [file, drawing] of Object.entries(sources.drawings)) {
    const name = pascalName(file);
    byFile.set(file, {
      kind: 'lucide',
      id: `lucide:${name}`,
      name,
      aliases: sources.aliases[file] ?? [],
      drawing,
      tags: sources.tags[file] ?? [],
      kitNames: kitByFile.get(file) ?? [],
    });
  }
  const lucide = [...byFile.values()].sort((a, b) => a.name.localeCompare(b.name));
  const kit = sources.kitNames.flatMap((name): KitIcon[] => {
    const glyph = byFile.get(sources.glyphs[name]);
    return glyph ? [{ kind: 'kit', id: `kit:${name}`, name, glyph }] : [];
  });
  const byId = new Map<string, FinderIcon>([...kit, ...lucide].map((icon) => [icon.id, icon]));
  return { kit, lucide, byId };
}

/** A name's words, lowercase: `FolderOpen` and `folder-open` are "folder" and "open". */
function nameWords(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
}

/** What a search matches an icon against, and how well, best first. */
interface Haystack {
  /** The name as one lowercase word, for a query typed as written (`folderopen`). */
  readonly joined: string;
  readonly nameWords: readonly string[];
  /** Words of the aliases and the tags, matched after the name. */
  readonly otherWords: readonly string[];
}

function haystackOf(icon: FinderIcon): Haystack {
  const name = icon.name;
  const glyph = icon.kind === 'kit' ? icon.glyph : icon;
  const own = icon.kind === 'kit' ? nameWords(name) : [];
  return {
    joined: name.replace(/-/g, '').toLowerCase(),
    nameWords: [...own, ...nameWords(glyph.name)],
    // An alias also as written (`trash2`), as the name is in `joined`.
    otherWords: [
      ...glyph.aliases.map((alias) => alias.toLowerCase()),
      ...glyph.aliases.flatMap(nameWords),
      ...glyph.tags.flatMap(nameWords),
    ],
  };
}

/**
 * How well `icon` matches `query`, lower is better, or null when it does not: every word of the
 * query must begin a word of the icon's name, an alias or a tag. A kit name is matched by its own
 * words and its glyph's, so "delete" finds the kit's name for a glyph tagged with it.
 *
 * 0: the name is the query; 1: the name begins with it; 2: every word begins a word of the name;
 * 3: some word is only in an alias or a tag.
 */
export function matchScore(icon: FinderIcon, query: string): number | null {
  const words = query
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (!words.length) return 3;
  const hay = haystackOf(icon);
  const typed = words.join('');
  if (hay.joined === typed) return 0;
  if (hay.joined.startsWith(typed)) return 1;
  const inName = (word: string) => hay.nameWords.some((own) => own.startsWith(word));
  const inOther = (word: string) => hay.otherWords.some((other) => other.startsWith(word));
  if (words.every(inName)) return 2;
  return words.every((word) => inName(word) || inOther(word)) ? 3 : null;
}

/** The icons that match `query`, best first and otherwise in their order; all for an empty one. */
export function search<T extends FinderIcon>(list: readonly T[], query: string): readonly T[] {
  if (!query.trim()) return list;
  return list
    .map((icon, index) => ({ icon, index, score: matchScore(icon, query) }))
    .filter((hit): hit is { icon: T; index: number; score: number } => hit.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((hit) => hit.icon);
}

/** The index of the kit's icons and every Lucide glyph, built once when the finder loads. */
export const ICON_INDEX = buildIconIndex({
  drawings: lucideDrawings as unknown as Readonly<Record<string, NeatIconGlyph>>,
  tags: lucideTags,
  aliases: LUCIDE_ALIASES,
  kitNames: NEAT_ICON_NAMES,
  glyphs: ICON_GLYPHS,
});

/** How an app uses an icon, as the finder's snippet shows it. */
export function usageOf(icon: FinderIcon): string {
  if (icon.kind === 'kit') return `<neat-icon name="${icon.name}" />`;
  return [
    `import { ${icon.name} } from '@sima/neat-ui/lucide';`,
    '',
    `// In the component class:`,
    `protected readonly ${icon.name} = ${icon.name};`,
    '',
    `// In its template:`,
    `<neat-icon [name]="${icon.name}" />`,
  ].join('\n');
}
