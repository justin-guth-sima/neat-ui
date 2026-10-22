import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
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
import { safeStorage } from '../storage';
import { ThemeService } from '../theme/theme.service';
import { NeatTooltip } from '../tooltip/tooltip';
import { NeatLogo } from './logo';
import { NeatNavItem } from './nav-item';

const RAIL_EXPANDED_KEY = 'neat-ui:rail-expanded';

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
 * elements marked `neatTopbarEnd` go to the right side of the top bar.
 *
 * Kiosk mode (`KioskService`, entered from the top bar or with `?kiosk`) drops the rail and the
 * top bar, gives the content area the whole viewport and floats an exit control over its top
 * right corner while the pointer moves.
 */
@Component({
  selector: 'neat-shell',
  imports: [
    NeatButton,
    NeatIcon,
    NeatKioskExit,
    NeatLogo,
    NeatTooltip,
    RouterLink,
    RouterLinkActive,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-kiosk]': 'kiosk.active()' },
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class NeatShell {
  readonly appName = input.required<string>();
  readonly navItems = input.required<NeatNavItem[]>();

  protected readonly theme = inject(ThemeService);
  protected readonly kiosk = inject(KioskService);
  private readonly router = inject(Router);

  protected readonly activeMatch = ACTIVE_MATCH;
  protected readonly railExpanded = signal(safeStorage.get(RAIL_EXPANDED_KEY) === 'true');
  private readonly kioskExit = viewChild(NeatKioskExit);

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
    const injector = inject(Injector);
    let wasActive = this.kiosk.active();
    effect(() => {
      const active = this.kiosk.active();
      if (active && !wasActive) {
        afterNextRender(() => this.kioskExit()?.focus(), { injector });
      }
      wasActive = active;
    });
  }

  protected toggleRail(): void {
    const expanded = !this.railExpanded();
    this.railExpanded.set(expanded);
    safeStorage.set(RAIL_EXPANDED_KEY, String(expanded));
  }
}
