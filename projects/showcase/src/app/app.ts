import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatNavItem, NeatShell } from '@sima/neat-ui';
import { NeatSearchPalette } from '@sima/neat-ui/search-palette';
import { NeatToastHost } from '@sima/neat-ui/toast';
import { GETTING_STARTED, SEARCH, TUTORIAL } from './app.routes';
import { groupNavItems } from './docs/docs-routes';
import { KIT_VERSION } from './docs/generated/kit-version';
import { GROUPS } from './docs/topics';
import { DocsSearch } from './search/docs-search';

/**
 * The showcase's own root. `NeatShell` takes the app's name and its navigation (`navItems`), here
 * Getting started and one rail item per group of the docs, with the group's topics or categories
 * as the item's `children`, and `NeatToastHost` is rendered once, beside the shell. The rail keeps
 * only the kit's theme switch and its control at its bottom; the Rail items example shows an
 * app's own items there. The top bar holds the docs' search (`neatTopbarEnd`), which Ctrl K opens
 * from any page. Under the app name the shell shows the kit's version (`appDetail`).
 */
@Component({
  imports: [NeatSearchPalette, NeatShell, NeatToastHost, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  /** The docs' search: topics at once, the API and the examples once its index has loaded. */
  protected readonly search = inject(DocsSearch).palette;
  protected readonly searchPage = `/${SEARCH}`;
  /** The kit's version, shown under the app name as the shell's `appDetail`. */
  protected readonly kitVersion = KIT_VERSION;

  /**
   * Getting started with its Quick start and Tutorial, then the docs' groups (Theme, Layout,
   * Components) with their sub-pages.
   */
  protected readonly navItems: NeatNavItem[] = [
    {
      label: 'Getting started',
      icon: 'home',
      path: `/${GETTING_STARTED}`,
      children: [
        { label: 'Quick start', path: `/${GETTING_STARTED}` },
        { label: 'Tutorial', path: `/${TUTORIAL}` },
      ],
    },
    ...groupNavItems(GROUPS),
  ];
}
