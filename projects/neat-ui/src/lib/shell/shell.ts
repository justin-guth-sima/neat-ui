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
  containsTree,
  IsActiveMatchOptions,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { NeatButton } from '../button/button';
import { NeatIcon } from '../icon/icon';
import { NeatKioskExit } from '../kiosk/kiosk-exit';
import { KioskService } from '../kiosk/kiosk.service';
import { AsideToggleSlot } from '../page/aside';
import { NeatViewport } from '../page/viewport';
import { ThemeService } from '../theme/theme.service';
import { NeatTooltip } from '../tooltip/tooltip';
import { NeatLogo } from './logo';
import { NeatNavItem } from './nav-item';
import { PageToolbarSlot } from './page-toolbar';
import { NeatRailItem, RailState } from './rail-item';

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

/**
 * The app frame: the rail on the left, which is the app's, the top bar, which is the page's, and
 * the content area for the routed page. It fills the viewport; the content area gives its page the
 * remaining space and never scrolls itself, so pages own their scrolling (see `neat-page`).
 *
 * The rail holds the pages (`navItems`) and, at its bottom below a divider, the app's own items
 * (elements marked `neatRailEnd`, usually `neatRailItem`s), then the kit's theme switch ("Dark
 * theme"), then the rail's control that shows and hides the labels. Expanded, its items show icon
 * and label; collapsed, the icon with the label as a tooltip and as hidden text.
 *
 * The top bar holds the logo, the app name and the page title, then at its right the active page's
 * tools (`*neatPageToolbar`), elements marked `neatTopbarEnd`, the kiosk button (the one app
 * control there, since it changes how the page is shown), and last, at the right edge above the
 * side panel, the page's side-panel toggle (`neat-aside-toggle`) when the page has one. The
 * default slot is the content area (usually a `<router-outlet />`).
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
    NeatRailItem,
    NeatTooltip,
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
  readonly appName = input.required<string>();
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

  /** Label of the nav item the current route belongs to; the first match wins. */
  protected readonly pageTitle = computed(() => {
    const url = this.router.lastSuccessfulNavigation()?.finalUrl;
    if (!url) {
      return '';
    }
    const active = this.navItems().find((item) =>
      containsTree(url, this.router.parseUrl(item.path), ACTIVE_MATCH),
    );
    return active?.label ?? '';
  });

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
