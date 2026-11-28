import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkPortalOutlet } from '@angular/cdk/portal';
import { BrnSheet, BrnSheetContent, BrnSheetOverlay } from '@spartan-ng/brain/sheet';
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
import { provideExpandArea, SHELL_CONTENT_AREA } from '../expand/expand-area';
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
import { NeatPageToolbarDivider, PageToolbarSlot } from './page-toolbar';
import { NeatRailDivider, NeatRailItem, RailState } from './rail-item';
import { DrawerDismiss } from './drawer-dismiss';
import { RailMenu } from './rail-menu';
import {
  DRAWER_CLASSES,
  SIDEBAR_BRAND_CLASSES,
  SIDEBAR_CLASSES,
  SIDEBAR_CONTAINER_CLASSES,
  SIDEBAR_HELM_CLASSES,
} from './sidebar-classes';

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

/** The classes of the sidebar's parts, helm's (`sidebar-classes.ts`), by the part they style. */
const SIDEBAR_PART_CLASSES = {
  ...SIDEBAR_HELM_CLASSES,
  sidebar: SIDEBAR_CLASSES,
  container: SIDEBAR_CONTAINER_CLASSES,
  brand: SIDEBAR_BRAND_CLASSES,
} as const;

/** Numbers the shells on a page, so that each trigger's id is its own. */
let shellCount = 0;

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
 * The app frame: a sidebar of pages on the left, a top bar, and the content area for the page. It
 * is Spartan's sidebar layout.
 *
 * ```html
 * <neat-shell appName="Insight" [navItems]="navItems">
 *   <router-outlet />
 * </neat-shell>
 * ```
 *
 * The sidebar is the app's, the top bar is the page's. The sidebar comes first in the DOM, so the
 * tab order is the visual one: sidebar, top bar, content.
 *
 * The shell fills the viewport, or the bounded box it is placed in. The content area gives its page
 * the remaining space and never scrolls itself, so pages own their scrolling (see `neat-page`).
 *
 * **The sidebar** (the rail) holds, from the top:
 * - the header: the logo, the app name and `appDetail`, the short line under it. It is not a
 *   control. Collapsed, it shows the logo alone;
 * - the pages, `navItems`, as the sidebar's menu rows. The navigation scrolls when the pages do not
 *   fit, collapsed and expanded;
 * - the footer: a divider, the app's own items (elements marked `neatRailEnd`, which are
 *   `neatRailItem`s and the `neatRailDivider`s between groups of them) and the kit's theme item.
 *
 * Expanded (16rem), its items show icon and label. Collapsed (3rem), they show the icon, with the
 * label as a tooltip and as hidden text. The theme item is an action named for what a click does:
 * "Dark theme" or "Light theme". An app's own `neat-icon` in a rail item is drawn at 16 px, whatever
 * its `size`, so apps need no change.
 *
 * The top bar starts with the sidebar's trigger, "Show labels" while the sidebar is collapsed and
 * "Hide labels" while it is expanded, then a divider and the page title. A click on the sidebar's
 * edge toggles it too, for a pointer. The choice is remembered in the browser.
 *
 * **Sub-pages.** A page with `children` unfolds them under its item while it is the active page
 * and the rail shows its labels: expanded, or in the drawer on a narrow screen. They are rows of
 * text, indented under a thin line, the open one in the rail's current-page look. Only the active
 * page's children show, so the rail does not grow with every page's sub-pages.
 *
 * The page's item then keeps its label in full text color at weight 500, without the fill. So one
 * row alone reads as current, and only that row carries `aria-current="page"`.
 *
 * Collapsed, the rail has no room for sub-pages. Its item for a page with `children` stays a link
 * to the page's `path`, and a press navigates, as on any rail item. The item keeps the current-page
 * look while the route belongs to the page.
 *
 * A menu of the sub-pages beside the rail goes with mouse hover and keyboard focus only. Tab steps
 * from the item into its links, and Escape closes it. A tap shows none, since the rail can be
 * expanded. The menu's heading is the page's label, which is why that item has no tooltip.
 *
 * **The top bar** holds the trigger and the page title. At its right it holds, in order:
 * - the active page's tools, `*neatPageToolbar`;
 * - elements marked `neatTopbarEnd`;
 * - the kiosk button, the one app control there, since it changes how the page is shown;
 * - last, at the right edge above the aside, the page's aside toggle (`neat-aside-toggle`), when
 *   the page has one.
 *
 * The page title is the matching nav item's label, else the route's `title`. On a page with
 * sub-pages, it is the open sub-page's label, with the page's label beside it, muted. On a route
 * deeper than the sub-page, with a `title` of its own (not an ancestor's), it is that title, with
 * "page › sub-page" beside it.
 *
 * The default slot is the content area, usually a `<router-outlet />`.
 *
 * **Kiosk mode** (`KioskService`) is entered from the top bar or with `?kiosk`. It drops the sidebar
 * and the top bar, and gives the content area the whole viewport. An exit control floats over its
 * top right corner while the pointer moves. The page toolbar, then the aside toggle, float beside
 * it on the same terms. Their views are re-created on entering and leaving kiosk mode, so the page
 * keeps their state.
 *
 * **On a narrow screen** (`NeatViewport`, below 48rem), there is no sidebar: the content takes the
 * whole width. The top bar's first row holds the trigger, the page title (truncated), the end slot,
 * the kiosk button and the aside toggle; the end slot grows from a zero basis, and the toggle comes
 * last. The page toolbar takes its own full-width second row. The app name stays in the top bar as
 * visually hidden text.
 *
 * The trigger, "Show navigation", opens a drawer from the left: a modal named by the app name,
 * holding the sidebar's header, pages and bottom items as expanded. The focus goes to the current
 * page's link, Escape and the scrim close it, and the focus goes back to the trigger. A followed
 * link closes it; a button (the theme item, the board) leaves it open. Opening it never touches the
 * remembered wide choice, and a screen that turns wide closes it.
 */
@Component({
  selector: 'neat-shell',
  imports: [
    BrnSheet,
    BrnSheetContent,
    BrnSheetOverlay,
    CdkPortalOutlet,
    DrawerDismiss,
    NgTemplateOutlet,
    NeatButton,
    NeatIcon,
    NeatKioskExit,
    NeatLogo,
    NeatPageToolbarDivider,
    NeatRailDivider,
    NeatRailItem,
    NeatTooltip,
    RailMenu,
    RouterLink,
    RouterLinkActive,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    // To its own template and to the app's items projected into the rail.
    RailState,
    // To what expands inside the content area, a routed page among it (`NeatExpand`'s `content`).
    provideExpandArea(SHELL_CONTENT_AREA, ':scope > main.content'),
  ],
  host: {
    '[attr.data-kiosk]': 'kiosk.active()',
    '[attr.data-narrow]': 'viewport.narrow()',
  },
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class NeatShell {
  // The host's `data-narrow` says which layout a narrow screen gets, and the CSS reacts to that,
  // never to a second `@media` with the breakpoint.

  /**
   * The app's name, shown beside the logo in the sidebar's header and the drawer's; on a narrow
   * screen it is also in the top bar, read out only.
   */
  readonly appName = input.required<string>();
  /**
   * A short line under the app name in the sidebar's header, smaller and muted, such as a version
   * ("0.45.0"). Without it the header shows the name alone.
   */
  readonly appDetail = input<string>();
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
  protected readonly classes = SIDEBAR_PART_CLASSES;
  protected readonly drawerClasses = DRAWER_CLASSES;
  private readonly rail = inject(RailState);
  protected readonly railExpanded = this.rail.expanded;
  /** Whether the sidebar's parts show their labels; in the drawer always, also while it closes. */
  protected readonly labelsShown = this.rail.labelsShown;
  /** The trigger's id, where the drawer gives the focus back on closing. */
  protected readonly triggerId = `neat-shell-trigger-${++shellCount}`;
  /** The trigger's name and tooltip: what a press does. */
  protected readonly triggerLabel = computed(() =>
    this.viewport.narrow()
      ? 'Show navigation'
      : this.railExpanded()
        ? 'Hide labels'
        : 'Show labels',
  );
  private readonly kioskExit = viewChild(NeatKioskExit);
  private readonly kioskButton = viewChild<ElementRef<HTMLElement>>('kioskButton');
  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly wideSidebar = viewChild<ElementRef<HTMLElement>>('wideSidebar');
  private readonly document = inject(DOCUMENT);

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
    return this.labelsShown() && active?.item.children?.length ? active : undefined;
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

    // The mirror of widening, where the drawer gives the focus back to the trigger: narrowing
    // removes the wide sidebar, which drops a focus inside it to <body>; hand it to the trigger,
    // which opens the drawer. The effect runs before the render that removes the sidebar, so the
    // focus is still where it was.
    effect(() => {
      if (!this.viewport.narrow()) {
        return;
      }
      const sidebar = untracked(() => this.wideSidebar())?.nativeElement;
      if (sidebar?.contains(this.document.activeElement)) {
        afterNextRender(() => this.trigger().nativeElement.focus(), { injector: this.injector });
      }
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

  /**
   * Escape or the scrim closed the drawer, or it closed by itself: the CDK's dialog closes on a
   * history step. Brain emits nothing when the drawer goes with a screen that turns wide, so the
   * remembered wide choice is never written here.
   */
  protected closeDrawer(): void {
    this.rail.set(false);
  }
}
