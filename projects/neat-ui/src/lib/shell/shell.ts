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
  signal,
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
import { NeatViewport } from '../page/viewport';
import { safeStorage } from '../storage';
import { ThemeService } from '../theme/theme.service';
import { NeatTooltip } from '../tooltip/tooltip';
import { NeatLogo } from './logo';
import { NeatNavItem } from './nav-item';
import { PageToolbarSlot } from './page-toolbar';

const RAIL_EXPANDED_KEY = 'neat-ui:rail-expanded';

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
 * The app frame: an icon rail with the pages on the left (expandable to show labels), a top bar
 * with logo, app name, page title and app-specific items, and the content area for the routed
 * page. It fills the viewport; the content area gives its page the remaining space and never
 * scrolls itself, so pages own their scrolling (see `neat-page`).
 *
 * Content projection: the default slot is the content area (usually a `<router-outlet />`);
 * elements marked `neatTopbarEnd` go to the right side of the top bar. The active page's own
 * controls (`*neatPageToolbar`) sit at the right of the top bar, just before that end slot.
 *
 * Kiosk mode (`KioskService`, entered from the top bar or with `?kiosk`) drops the rail and the
 * top bar, gives the content area the whole viewport and floats an exit control over its top
 * right corner while the pointer moves; the page toolbar floats beside it on the same terms. Its
 * view is re-created on entering and leaving kiosk mode, so the page keeps the toolbar's state.
 *
 * On a narrow screen (`NeatViewport`, below 48rem) the top bar drops what a phone has no room for
 * (the app name stays only as the logo's accessible name, and the page title goes) and tightens
 * its spacing, and an expanded rail floats over the content instead of squeezing it. The host's
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
    NeatTooltip,
    RouterLink,
    RouterLinkActive,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  protected readonly toolbarLabel = PAGE_TOOLBAR_LABEL;
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly activeMatch = ACTIVE_MATCH;
  protected readonly railExpanded = signal(safeStorage.get(RAIL_EXPANDED_KEY) === 'true');
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
    const expanded = !this.railExpanded();
    this.railExpanded.set(expanded);
    safeStorage.set(RAIL_EXPANDED_KEY, String(expanded));
  }
}
