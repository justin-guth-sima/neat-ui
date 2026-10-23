/*
 * The pure helpers behind the file browser: they read a tree of `NeatFileNode`s and know nothing
 * of the UI. They are the helpers of the media browser the kit's was extracted from, in the kit's
 * vocabulary. A folder is named by its path, relative and with `/` between the segments; '' is the
 * root.
 */

/** One entry of the tree a `neat-file-browser` shows: a folder with its children, or a file. */
export interface NeatFileNode {
  /** What the row shows. */
  readonly name: string;
  /** Unique in the tree: relative, with `/` between segments, so a folder's path leads to it. */
  readonly path: string;
  readonly type: 'folder' | 'file';
  /** A folder's entries. */
  readonly children?: readonly NeatFileNode[];
  /**
   * Greys the row without hiding it. It does not stop the row from being selected, opened or
   * checked, and a disabled file does not count towards a folder's count: an app that must not
   * offer a file leaves it out of the tree.
   */
  readonly disabled?: boolean;
  /** A short text after the name, such as the reason the row is greyed. */
  readonly tag?: string;
}

/** A folder of a listing, with the number of enabled files in it and below. */
export interface FolderEntry {
  readonly node: NeatFileNode;
  readonly name: string;
  readonly path: string;
  readonly count: number;
}

/** A file that matched a search: `relative` is its path below the folder searched. */
export interface FileMatch {
  readonly node: NeatFileNode;
  readonly relative: string;
}

export const ROOT = '';

/**
 * Names and paths sort without regard to case, as a person looks for them. The locale is fixed so
 * that the order does not depend on the browser's: punctuation, digits and accents sort the same
 * everywhere (and not as a server's `lower()` would).
 */
const collator = new Intl.Collator('en', { sensitivity: 'base' });

const byName = (a: NeatFileNode, b: NeatFileNode): number => collator.compare(a.name, b.name);

/** The children of `folderPath`, or null when that folder is not in `tree`. */
export function childrenAt(
  tree: readonly NeatFileNode[] | undefined,
  folderPath: string,
): readonly NeatFileNode[] | null {
  let nodes = tree ?? [];
  if (!folderPath) return nodes;
  let path = '';
  for (const segment of folderPath.split('/')) {
    path = path ? `${path}/${segment}` : segment;
    const next = nodes.find((node) => node.type === 'folder' && node.path === path);
    if (!next) return null;
    nodes = next.children ?? [];
  }
  return nodes;
}

export function folderExists(tree: readonly NeatFileNode[], folderPath: string): boolean {
  return childrenAt(tree, folderPath) !== null;
}

/** Folders first, then files, each by name; an unknown folder lists as empty. */
export function listFolder(
  tree: readonly NeatFileNode[],
  folderPath: string,
): { folders: FolderEntry[]; files: NeatFileNode[] } {
  const nodes = childrenAt(tree, folderPath) ?? [];
  const folders = nodes
    .filter((node) => node.type === 'folder')
    .sort(byName)
    .map((node) => ({
      node,
      name: node.name,
      path: node.path,
      count: enabledFilePaths(node.children).length,
    }));
  const files = nodes.filter((node) => node.type === 'file').sort(byName);
  return { folders, files };
}

/** Enabled files in `folderPath` and all its subfolders: what a folder's badge shows for it. */
export function playableCount(tree: readonly NeatFileNode[], folderPath: string): number {
  return enabledFilePaths(childrenAt(tree, folderPath) ?? []).length;
}

export function parentPath(folderPath: string): string {
  if (!folderPath) return ROOT;
  const index = folderPath.lastIndexOf('/');
  return index === -1 ? ROOT : folderPath.slice(0, index);
}

/** `[{ name: rootLabel, path: '' }, { name: '30FPS', path: '30FPS' }, ...]` */
export function breadcrumbs(
  folderPath: string,
  rootLabel: string,
): { name: string; path: string }[] {
  const crumbs = [{ name: rootLabel, path: ROOT }];
  if (!folderPath) return crumbs;
  let path = '';
  for (const segment of folderPath.split('/')) {
    path = path ? `${path}/${segment}` : segment;
    crumbs.push({ name: segment, path });
  }
  return crumbs;
}

/**
 * Every file anywhere below `folderPath`, enabled or not, whose path relative to that folder
 * contains `query` without regard to case, sorted by relative path (the tree's own order, which
 * the listing sorts too, would put a subfolder's files among the folder's). `relative` is what the list shows;
 * the node's `path` is the one to act on.
 */
export function searchFolder(
  tree: readonly NeatFileNode[],
  folderPath: string,
  query: string,
): FileMatch[] {
  const needle = query.trim().toLowerCase();
  const nodes = childrenAt(tree, folderPath);
  if (!needle || nodes === null) return [];
  const prefix = folderPath ? `${folderPath}/` : '';
  const matches: FileMatch[] = [];
  const walk = (list: readonly NeatFileNode[]): void => {
    for (const node of list) {
      if (node.type === 'folder') {
        walk(node.children ?? []);
      } else {
        const relative = node.path.startsWith(prefix) ? node.path.slice(prefix.length) : node.path;
        if (relative.toLowerCase().includes(needle)) matches.push({ node, relative });
      }
    }
  };
  walk(nodes);
  return matches.sort((a, b) => collator.compare(a.relative, b.relative));
}

/** The folder itself when it still exists after a reload, otherwise its nearest existing ancestor. */
export function nearestExistingFolder(tree: readonly NeatFileNode[], folderPath: string): string {
  let candidate = folderPath || ROOT;
  while (candidate && !folderExists(tree, candidate)) candidate = parentPath(candidate);
  return candidate;
}

/**
 * The folder just below `ancestor` on the way to `descendant`, or null when `descendant` is not
 * below `ancestor`: where the user came from when going up.
 */
export function childTowards(descendant: string, ancestor: string): string | null {
  if (descendant === ancestor) return null;
  const prefix = ancestor ? `${ancestor}/` : '';
  if (!descendant.startsWith(prefix)) return null;
  return `${prefix}${descendant.slice(prefix.length).split('/')[0]}`;
}

/** Every enabled file's path in tree order. */
export function enabledFilePaths(
  tree: readonly NeatFileNode[] | undefined,
  acc: string[] = [],
): string[] {
  for (const node of tree ?? []) {
    if (node.type === 'file' && !node.disabled) acc.push(node.path);
    if (node.type === 'folder') enabledFilePaths(node.children, acc);
  }
  return acc;
}

/** Every file's path in tree order, enabled or not (a selection is pruned against this). */
export function allFilePaths(
  tree: readonly NeatFileNode[] | undefined,
  acc: string[] = [],
): string[] {
  for (const node of tree ?? []) {
    if (node.type === 'file') acc.push(node.path);
    if (node.type === 'folder') allFilePaths(node.children, acc);
  }
  return acc;
}
