import { NeatIconName } from '../icon/icon-registry';

/**
 * One sub-page of a page in the shell's rail. It has no icon: sub-pages are rows of text under
 * their page, which carries the icon.
 */
export interface NeatNavChild {
  /** Shown as the link's name and, while it is open, the page title. */
  label: string;
  /**
   * Absolute app path, for example `/theme/colours`. It is open on its own path and every route
   * nested under it, whatever the query; a child whose path is its page's own (a first view at
   * `/stats`, beside `/stats/runs`) is open on that path only, so it is not open on its siblings'
   * routes. Where two children match, the one with the longer path is open.
   */
  path: string;
}

/** One page in the shell's rail. */
export interface NeatNavItem {
  /** Shown as the link's name, its tooltip and, while the page is active, the page title. */
  label: string;
  icon: NeatIconName;
  /** Absolute app path, for example `/media`; the item stays active on routes nested under it. */
  path: string;
  /**
   * The page's sub-pages, the only second level of the rail's navigation (more than a few, or
   * deeper levels, belong in the page's own side list). They unfold under the item while the page
   * is active and the rail shows its labels; the open one carries `aria-current="page"` and the
   * item then does not. The item's link still goes to `path`: the app routes it to the first
   * sub-page, or gives the first sub-page the page's own path. The kit does not redirect.
   * Collapsed, a press on the item goes to `path` as well, and hovering it with a mouse or
   * focusing it with the keyboard shows them as a menu beside the rail.
   */
  children?: readonly NeatNavChild[];
}
