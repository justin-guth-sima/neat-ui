/**
 * The showcase's one way of matching a search to a name and other words, which the docs' search and
 * the icon finder share: every word typed must begin a word of the item, its name first.
 */

/** Where text breaks into words: spaces and the punctuation of names (`-`, `.`, `_`, `/`). */
const BREAKS = /[\s\-._/]+/;

/** A text's words, lowercase: `FolderOpen`, `folder-open` and "Folder open" are "folder", "open". */
export function wordsOf(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .toLowerCase()
    .split(BREAKS)
    .filter(Boolean);
}

/** What a search is matched against, best first. */
export interface Haystack {
  /** The name as one lowercase word, for a name typed as written (`folderopen`, `neatsearch`). */
  readonly joined: string;
  /** The words of the name, and of any name it counts as its own (a kit icon's glyph). */
  readonly nameWords: readonly string[];
  /** Other words (aliases, tags, a summary), matched after the name. */
  readonly otherWords: readonly string[];
}

/** A name's pieces between its punctuation, whole: `NeatSlider.describedBy` is two. */
function piecesOf(name: string): string[] {
  return name.toLowerCase().split(BREAKS).filter(Boolean);
}

/**
 * A haystack of a name, other names counted as its own, and other words. A name's words are its
 * camel-case words and its pieces whole, so "describedby" finds `NeatSlider.describedBy`.
 */
export function haystack(
  name: string,
  alsoNames: readonly string[] = [],
  other: readonly string[] = [],
): Haystack {
  const names = [name, ...alsoNames];
  return {
    joined: name.toLowerCase().replace(new RegExp(BREAKS.source, 'g'), ''),
    nameWords: [...names.flatMap(wordsOf), ...names.flatMap(piecesOf)],
    otherWords: other,
  };
}

/**
 * How well a haystack matches `query`, lower is better, or null when it does not.
 *
 * 0: the name is the query; 1: the name begins with it; 2: every word begins a word of the name;
 * 3: some word is only in the other words.
 */
export function matchScore(hay: Haystack, query: string): number | null {
  const words = query.toLowerCase().split(BREAKS).filter(Boolean);
  if (!words.length) return 3;
  const typed = words.join('');
  if (hay.joined === typed) return 0;
  if (hay.joined.startsWith(typed)) return 1;
  const inName = (word: string) => hay.nameWords.some((own) => own.startsWith(word));
  const inOther = (word: string) => hay.otherWords.some((other) => other.startsWith(word));
  if (words.every(inName)) return 2;
  return words.every((word) => inName(word) || inOther(word)) ? 3 : null;
}

/** The items that match `query`, best first and otherwise in their order; all for an empty one. */
export function rank<T>(
  list: readonly T[],
  query: string,
  haystackOf: (item: T) => Haystack,
): readonly T[] {
  if (!query.trim()) return list;
  return list
    .map((item, index) => ({ item, index, score: matchScore(haystackOf(item), query) }))
    .filter((hit): hit is { item: T; index: number; score: number } => hit.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((hit) => hit.item);
}
