import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatNavItem, NeatShell } from '@sima/neat-ui';
import { NeatSearchPalette } from '@sima/neat-ui/search-palette';
import { NeatToastHost } from '@sima/neat-ui/toast';
import { GETTING_STARTED, SEARCH } from './app.routes';
import { groupNavItems } from './docs/docs-routes';
import { GROUPS } from './docs/topics';
import { DocsSearch } from './search/docs-search';

/**
 * The showcase's own root. `NeatShell` takes the app's name and its navigation (`navItems`), here
 * Getting started and one rail item per group of the docs, with the group's topics or categories
 * as the item's `children`, and `NeatToastHost` is rendered once, beside the shell. The rail keeps
 * only the kit's theme switch and its control at its bottom; the Rail items example shows an
 * app's own items there. The top bar holds the docs' search (`neatTopbarEnd`), which Ctrl K opens
 * from any page.
 */
@Component({
  imports: [NeatSearchPalette, NeatShell, NeatToastHost, RouterOutlet],
  selector: 'app-root',
  template: `
    <neat-shell appName="neat-ui showcase" [navItems]="navItems">
      <neat-search-palette
        neatTopbarEnd
        label="Search docs"
        [search]="search"
        [allResults]="searchPage"
      />
      <router-outlet />
    </neat-shell>
    <neat-toast-host />
  `,
})
export class App {
  /** The docs' search: topics at once, the API and the examples once its index has loaded. */
  protected readonly search = inject(DocsSearch).palette;
  protected readonly searchPage = `/${SEARCH}`;

  /** Getting started, then the docs' groups (Theme, Layout, Components) with their sub-pages. */
  protected readonly navItems: NeatNavItem[] = [
    { label: 'Getting started', icon: 'info', path: `/${GETTING_STARTED}` },
    ...groupNavItems(GROUPS),
  ];
}
