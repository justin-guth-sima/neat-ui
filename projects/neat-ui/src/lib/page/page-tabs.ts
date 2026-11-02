import { AfterViewInit, Directive, ElementRef, inject, input, isDevMode } from '@angular/core';
import { IsActiveMatchOptions, Router, RouterLink } from '@angular/router';

/**
 * What decides that a tab's route is the open one. Only the path counts: the query and the
 * fragment of the URL belong to the view behind the tab (a sort order, the runs being compared),
 * and a tab that went dark whenever they changed would stop saying where the user is.
 */
const MATCH: Record<'exact' | 'subset', IsActiveMatchOptions> = {
  exact: { paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' },
  subset: {
    paths: 'subset',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  },
};

/**
 * The row of a page's tabs: `<nav neatPageTabs aria-label="Stats views">` with an
 * `a[neatPageTab]` per view, as a direct child of `neat-page`, which draws it full width above the
 * page's body and side panel (a page without it has no row).
 *
 * These are links between routes, the page's views, not an in-page tablist (`neat-tabs` is
 * that, with arrow keys and one tab stop): a screen reader hears a navigation landmark of links
 * and the open one is `aria-current="page"`, and every link is a tab stop of its own. So the
 * landmark needs a name, which only the app knows: a nav without an `aria-label` (or
 * `aria-labelledby`) throws in dev mode.
 *
 * Left-aligned text, 16px apart, divided from the page by a border. The row scrolls sideways
 * when its tabs do not fit, and its tabs never wrap. Class strings stay literals: Tailwind finds
 * the classes the kit stylesheet needs by reading them.
 *
 * @deprecated Tabs are not navigation: a page's sub-pages are its rail item's children
 * (`NeatNavItem.children`), and more links than that go in the page's side list (`NeatPageNav`).
 * Page tabs go in the next release.
 */
@Directive({
  selector: 'nav[neatPageTabs]',
  host: {
    class:
      'flex flex-none items-stretch gap-(--neat-space-4) overflow-x-auto border-b border-border px-(--neat-space-6)',
  },
})
export class NeatPageTabs implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  // After the first check, so a name the app binds (`[attr.aria-label]`) is on the element.
  ngAfterViewInit(): void {
    if (
      isDevMode() &&
      !this.host.hasAttribute('aria-label') &&
      !this.host.hasAttribute('aria-labelledby')
    ) {
      throw new Error(
        'nav[neatPageTabs] needs an aria-label (or aria-labelledby) naming the views.',
      );
    }
  }
}

/**
 * One tab of `neatPageTabs`, a link to the view's route: `<a neatPageTab routerLink="/stats/runs">`.
 * It is the open tab while the router's URL is its `routerLink`'s: `activeMatch="exact"` (the
 * default) takes only that path, `"subset"` also the routes nested under it (a run's page under
 * "Runs"). Open, it carries `aria-current="page"` and is drawn in the foreground colour, semibold
 * and underlined in `--primary`; the others are `--muted-foreground` and take the foreground on
 * hover. The focus ring is inset, since the row clips what is drawn outside it.
 *
 * @deprecated Tabs are not navigation: a page's sub-pages are its rail item's children
 * (`NeatNavItem.children`), and more links than that go in the page's side list (`NeatPageNav`).
 * Page tabs go in the next release.
 */
@Directive({
  selector: 'a[neatPageTab]',
  host: {
    class:
      'shrink-0 whitespace-nowrap border-b-2 border-transparent py-2 leading-5 text-(length:--neat-text-sm) font-medium text-muted-foreground no-underline hover:text-foreground focus-visible:outline-(length:--neat-focus-ring-width) focus-visible:outline-offset-[calc(-1*var(--neat-focus-ring-width))] data-active:border-primary data-active:font-semibold data-active:text-foreground',
    '[attr.aria-current]': "active() ? 'page' : null",
    '[attr.data-active]': "active() ? '' : null",
  },
})
export class NeatPageTab {
  /** Whether the nested routes of the tab's route keep it open too (`subset`), or not (`exact`). */
  readonly activeMatch = input<'exact' | 'subset'>('exact');

  private readonly router = inject(Router);
  private readonly link = inject(RouterLink, { self: true });

  /**
   * Asked of the router when the host is checked, not stored: the router's last navigation is a
   * signal, so a navigation (back and forward too) checks the host again, and so does a change of
   * the tab's own link or match, which are inputs of the same template.
   */
  protected active(): boolean {
    this.router.lastSuccessfulNavigation();
    const tree = this.link.urlTree;
    return tree !== null && this.router.isActive(tree, MATCH[this.activeMatch()]);
  }
}
