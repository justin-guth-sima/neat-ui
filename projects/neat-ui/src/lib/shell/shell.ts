import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  viewChild,
} from '@angular/core';
import { CdkPortalOutlet } from '@angular/cdk/portal';
import {
  ActivatedRouteSnapshot,
  containsTree,
  IsActiveMatchOptions,
  PRIMARY_OUTLET,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { NeatButton } from '../button/button';
import { NeatIcon } from '../icon/icon';
import { NeatKioskExit } from '../kiosk/kiosk-exit';
import { KioskService } from '../kiosk/kiosk.service';
import { AsideToggleSlot } from '../page/aside';
import { openLink } from '../page/open-link';
import { NeatViewport } from '../page/viewport';
import { ThemeService } from '../theme/theme.service';
import { NeatTooltip } from '../tooltip/tooltip';
import { NeatLogo } from './logo';
import { NeatNavChild, NeatNavItem } from './nav-item';
import { PageToolbarSlot } from './page-toolbar';
import { NeatRailDivider, NeatRailItem, RailState } from './rail-item';
import { RailMenu } from './rail-menu';

/**
 * The accessible name of the page toolbar's region, in the top bar and in kiosk mode alike. A
 * group, not a toolbar: `role="toolbar"` promises arrow-key navigation between its controls, which
 * would fight the arrow keys of sliders and segmented controls inside it.
 */
const PAGE_TOOLBAR_LABEL = 'Page tools';

/** A nav item is active on its own path and every route nested under it, whatever the query. */
const ACTIVE_MATCH: IsActiveMatchOptions = {
  paths: 'subset',
  queryParams: 'ignored',
  matrixParams: 'ignored',
  fragment: 'ignored',
};

/** A route is exactly a sub-page's path, no deeper, whatever the query. */
const EXACT_MATCH: IsActiveMatchOptions = { ...ACTIVE_MATCH, paths: 'exact' };

/**
 * The title of the deepest primary route that has one of its own, as the router's own title
 * strategy picks it for the document; '' when none has. A route's `title` is inherited from its
 * parent (the router's default), so a title counts only where it differs from the parent's. With
 * `skip`, only routes whose path reaches past its first `skip` segments count. The primary child,
 * not `firstChild`, which can be a named outlet's. The router commits its state before it records
 * the navigation as successful, so this is the navigation's own route.
 */
function routeTitle(root: ActivatedRouteSnapshot, skip?: number): string {
  let title = '';
  let reached = 0;
  let parentTitle: string | undefined;
  let route: ActivatedRouteSnapshot | undefined = root;
  while (route) {
    reached += route.url.length;
    if (route.title !== parentTitle && (skip === undefined || reached > skip)) {
      title = route.title ?? title;
    }
    parentTitle = route.title;
    route = route.children.find((child) => child.outlet === PRIMARY_OUTLET);
  }
  return title;
}

/**
 * The app frame: the rail on the left, which is the app's, the top bar, which is the page's, and
 * the content area for the routed page. It fills the viewport, or the bounded box it is placed in;
 * the content area gives its page the remaining space and never scrolls itself, so pages own their
 * scrolling (see `neat-page`).
 *
 * The rail holds the pages (`navItems`) and, at its bottom below a divider, the app's own items
 * (elements marked `neatRailEnd`: `neatRailItem`s, and `neatRailDivider`s between groups of them),
 * then the kit's theme item, then the rail's control. Expanded, its items show icon and label;
 * collapsed, the icon with the label as a tooltip and as hidden text. The theme item and the
 * control are actions named for what a click does: "Dark theme" or "Light theme", "Show labels" or
 * "Collapse".
 *
 * A page with `children` unfolds them under its item while it is the active page and the rail shows
 * its labels (expanded, or floating open on a narrow screen): rows of text, indented under a thin
 * line, the open one in the rail's current-page look. The item then keeps its label in full text
 * colour at weight 500 without the fill, so one row alone reads as current, and only that row
 * carries `aria-current="page"`. Only the active page's children show, so the rail does not grow
 * with every page's sub-pages.
 *
 * Collapsed, the rail has no room for them: its item for a page with `children` stays a link to the
 * page's `path`, and a press just navigates, as on any rail item. The menu of the sub-pages beside
 * the rail is a companion of mouse hover and keyboard focus only (Tab steps from the item into its
 * links, Escape closes it); a tap shows none, as the rail can be expanded. The item keeps the
 * current-page look while the route belongs to the page. The menu's heading is the page's label,
 * which is why that item has no tooltip.
 *
 * The top bar holds the logo, the app name and the page title, then at its right the active page's
 * tools (`*neatPageToolbar`), elements marked `neatTopbarEnd`, the kiosk button (the one app
 * control there, since it changes how the page is shown), and last, at the right edge above the
 * side panel, the page's side-panel toggle (`neat-aside-toggle`) when the page has one. The page
 * title is the matching nav item's label, else the route's `title`; on a page with sub-pages it is
 * the open sub-page's label with the page's label beside it, muted, or, on a route deeper than the
 * sub-page whose own `title` is set (not an ancestor's), that title with "page › sub-page" beside
 * it. The default slot is the content area (usually a `<router-outlet />`).
 *
 * Kiosk mode (`KioskService`, entered from the top bar or with `?kiosk`) drops the rail and the
 * top bar, gives the content area the whole viewport and floats an exit control over its top
 * right corner while the pointer moves; the page toolbar, then the side-panel toggle, float beside
 * it on the same terms. Their views are re-created on entering and leaving kiosk mode, so the page
 * keeps their state.
 *
 * On a narrow screen (`NeatViewport`, below 48rem) the app name and the page title are visually
 * hidden but stay for screen readers (the title as the page's `h1`; the name beside the logo,
 * which is also named "SiMa.ai"). The logo, the end slot, the kiosk button and the side-panel
 * toggle share the first row, the end slot growing from a zero basis and the toggle last, and the
 * page toolbar takes its own full-width second row. An
 * expanded rail floats over the content instead of squeezing it, starts collapsed without
 * touching the remembered choice, and collapses when one of its links is followed. The host's
 * `data-narrow` says which, and the CSS reacts to that, never to a second `@media`.
 */
@Component({
  selector: 'neat-shell',
  imports: [
    CdkPortalOutlet,
    NeatButton,
    NeatIcon,
    NeatKioskExit,
    NeatLogo,
    NeatRailDivider,
    NeatRailItem,
    NeatTooltip,
    RailMenu,
    RouterLink,
    RouterLinkActive,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // To its own template and to the app's items projected into the rail.
  providers: [RailState],
  host: {
    '[attr.data-kiosk]': 'kiosk.active()',
    '[attr.data-narrow]': 'viewport.narrow()',
  },
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class NeatShell {
  /**
   * The app's name, shown in the top bar beside the logo on a wide screen; on a narrow one it is
   * read out only.
   */
  readonly appName = input.required<string>();
  /** The pages the rail links to, in order: each an icon, a label and an absolute path. */
  readonly navItems = input.required<NeatNavItem[]>();

  protected readonly theme = inject(ThemeService);
  protected readonly kiosk = inject(KioskService);
  protected readonly viewport = inject(NeatViewport);
  protected readonly pageToolbar = inject(PageToolbarSlot).portal;
  protected readonly asideToggle = inject(AsideToggleSlot).portal;
  protected readonly toolbarLabel = PAGE_TOOLBAR_LABEL;
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly activeMatch = ACTIVE_MATCH;
  private readonly rail = inject(RailState);
  protected readonly railExpanded = this.rail.expanded;
  private readonly kioskExit = viewChild(NeatKioskExit);
  private readonly kioskButton = viewChild<ElementRef<HTMLElement>>('kioskButton');

  /**
   * The nav item the current route belongs to (the first match wins) and, when it has sub-pages,
   * the open one with whether the route is deeper than it.
   */
  private readonly active = computed(() => {
    const url = this.router.lastSuccessfulNavigation()?.finalUrl;
    if (!url) {
      return undefined;
    }
    const item = this.navItems().find((candidate) =>
      containsTree(url, this.router.parseUrl(candidate.path), ACTIVE_MATCH),
    );
    const child = item?.children && openLink(item.children, url, this.router, item.path);
    return item && { item, child, url };
  });

  /** The nav item whose sub-pages show in the rail, with its open one; none while collapsed. */
  protected readonly unfolded = computed(() => {
    const active = this.active();
    return this.railExpanded() && active?.item.children?.length ? active : undefined;
  });

  /**
   * The title's text and, beside it, the muted page it belongs to. A nav item's label wins over a
   * route's `title` because it is what the rail shows as the current page, and nested routes under
   * one item keep its name whatever their titles say; a page with sub-pages is the one exception,
   * where the open sub-page names the route, and a route deeper than it (a level-3 topic, a
   * compare view) names itself when it has a title, so the title says where the person is. Without
   * a nav item the route's own `title` is all there is, so a board's page or a detail view still
   * has a heading.
   */
  protected readonly pageTitle = computed((): { text: string; context?: string } => {
    const active = this.active();
    if (!active) {
      return { text: this.router.lastSuccessfulNavigation() ? this.routeTitle() : '' };
    }
    const { item, child, url } = active;
    if (!child) {
      return { text: item.label };
    }
    const deeper = !containsTree(url, this.router.parseUrl(child.path), EXACT_MATCH);
    // Only a route past the sub-page's own path: a title above it is the page's or the sub-page's.
    const own = deeper ? this.routeTitle(this.segmentCount(child.path)) : '';
    return own
      ? { text: own, context: `${item.label} › ${child.label}` }
      : { text: child.label, context: item.label };
  });

  /** Whether the item's open sub-page is showing, which then carries the current-page state. */
  protected holdsOpenChild(item: NeatNavItem): boolean {
    const unfolded = this.unfolded();
    return unfolded?.item === item && !!unfolded.child;
  }

  /** Whether the route belongs to the page, for the item that opens its menu while collapsed. */
  protected isActivePage(item: NeatNavItem): boolean {
    return this.active()?.item === item;
  }

  /** The page's open sub-page, which the collapsed rail's menu marks. */
  protected currentChild(item: NeatNavItem): NeatNavChild | undefined {
    const active = this.active();
    return active?.item === item ? active.child : undefined;
  }

  /** Whether `child` is the open sub-page of the unfolded page, for the link's current state. */
  protected isOpen(child: NeatNavChild): boolean {
    return this.unfolded()?.child === child;
  }

  private routeTitle(skip?: number): string {
    return routeTitle(this.router.routerState.snapshot.root, skip);
  }

  private segmentCount(path: string): number {
    return this.router.parseUrl(path).root.children[PRIMARY_OUTLET]?.segments.length ?? 0;
  }

  constructor() {
    // Entering kiosk mode removes the top-bar button that had focus, which drops focus to <body>,
    // and the next Tab would skip the exit control; hand focus to the exit control instead. Not
    // when kiosk mode comes from ?kiosk at start: nothing had focus to lose then.
    let wasActive = this.kiosk.active();
    effect(() => {
      const active = this.kiosk.active();
      if (active && !wasActive) {
        afterNextRender(() => this.kioskExit()?.focus(), { injector: this.injector });
      }
      wasActive = active;
    });
  }

  /**
   * The mirror of entering: leaving kiosk mode with the exit control removes it, which drops focus
   * to <body>; hand focus to the top-bar kiosk button that comes back, where kiosk mode was entered.
   * Not when kiosk mode ends otherwise (Esc leaving fullscreen, for example), when focus may be on
   * the page and must stay there.
   */
  protected focusKioskButtonAfterExit(): void {
    afterNextRender(() => this.kioskButton()?.nativeElement.focus(), { injector: this.injector });
  }

  protected toggleRail(): void {
    this.rail.set(!this.railExpanded());
  }
}
