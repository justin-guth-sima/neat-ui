import type { NeatIconGlyph, NeatIconName } from '../icon/icon-registry';

/**
 * One sub-page of a page in the shell's rail. It has no icon: sub-pages are rows of text under
 * their page, which carries the icon.
 */
export interface NeatNavChild {
  /** Shown as the link's name and, while it is open, the page title. */
  label: string;
  /**
   * Absolute app path, for example `/theme/colors`.
   *
   * It is open on its own path and every route nested under it, whatever the query. A child whose
   * path is its page's own, such as a first view at `/stats` beside `/stats/runs`, is open on that
   * path only. So it is not open on its siblings' routes. Where two children match, the one with
   * the longer path is open.
   */
  path: string;
}

/** One page in the shell's rail. */
export interface NeatNavItem {
  /** Shown as the link's name, its tooltip and, while the page is active, the page title. */
  label: string;
  /**
   * The page's icon, as `neat-icon`'s `name` takes it: a name of the kit's set (`'home'`) first,
   * and a glyph from `@sima/neat-ui/lucide` only where no name fits.
   */
  icon: NeatIconName | NeatIconGlyph;
  /** Absolute app path, for example `/media`; the item stays active on routes nested under it. */
  path: string;
  /**
   * The page's sub-pages, the only second level of the rail's navigation.
   *
   * More than a few, or deeper levels, belong in the page nav. They unfold under the item while the
   * page is active and the rail shows its labels. The open one carries `aria-current="page"`, and
   * the item then does not.
   *
   * The item's link still goes to `path`. The app routes it to the first sub-page, or gives the
   * first sub-page the page's own path: the kit does not redirect.
   *
   * Collapsed, a press on the item goes to `path` as well. Hovering it with a mouse, or focusing it
   * with the keyboard, shows the sub-pages as a menu beside the rail.
   */
  children?: readonly NeatNavChild[];
}
