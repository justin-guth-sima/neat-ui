import { Routes } from '@angular/router';
import { docsRoutes } from './docs/docs-routes';
import { GROUPS } from './docs/topics';

/** The page the showcase opens on, how an app starts on the kit: no group, so no sub-pages. */
export const GETTING_STARTED = 'getting-started';

/** The page of every result of the docs' search, which gets the search as `q`. */
export const SEARCH = 'search';

// Each page's title goes into the document's (`provideNeatTitles` in app.config.ts).
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: GETTING_STARTED },
  {
    path: GETTING_STARTED,
    title: 'Getting started',
    loadComponent: () => import('./pages/getting-started.page').then((m) => m.GettingStartedPage),
  },
  // Every result of the docs' search, which the top bar's palette links to; no rail item.
  {
    path: SEARCH,
    title: 'Search',
    loadComponent: () => import('./pages/search.page').then((m) => m.SearchPage),
  },
  // The docs: a page per topic of each group, at its group's or its category's address.
  ...docsRoutes(GROUPS),
  // A mistyped or retired address lands on Getting started, not on a blank page: an address that
  // changed gets no redirect of its own.
  { path: '**', redirectTo: GETTING_STARTED },
];
