import type { NeatDiagram, NeatDiagramNode, NeatDiagramSet } from './model';

/*
 * The drill-down path: the ids of the levels opened from the overview, each from a block of the
 * level before it. Pure, so the stale-route rule is decided (and tested) apart from the view.
 */

/** A path as far as it leads, with what the view shows for it. */
export interface WalkedLevels {
  /** The longest start of the path asked for that leads somewhere. */
  readonly path: readonly string[];
  /** The block that opens each level of `path`, in the level before it: the level's name. */
  readonly openers: readonly NeatDiagramNode[];
  /** The level at the end of `path`, the overview for the empty path. */
  readonly shown: NeatDiagram;
}

/**
 * Follows `asked` from the overview while each id names a level that a block of the level before
 * it opens, and stops at the first that does not (a route from an older diagram, a level the app
 * dropped). A level no block opens is not one the user can reach by clicking, and the level bar
 * names a level by the block that opens it, so such a path is cut there too.
 */
export function walkLevels(set: NeatDiagramSet, asked: readonly string[]): WalkedLevels {
  const path: string[] = [];
  const openers: NeatDiagramNode[] = [];
  let shown = set.overview;
  for (const id of asked) {
    // Own keys only: a path from a route may say "constructor".
    const next = set.levels && Object.hasOwn(set.levels, id) ? set.levels[id] : undefined;
    const opener = shown.nodes.find((node) => node.role === 'block' && node.opens === id);
    if (!next || !opener) break;
    path.push(id);
    openers.push(opener);
    shown = next;
  }
  return { path, openers, shown };
}

/** Whether two paths name the same levels. */
export function samePath(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
