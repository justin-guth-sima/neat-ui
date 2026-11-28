import { Routes } from '@angular/router';
import { docsRoutes } from './docs/docs-routes';
import { GROUPS } from './docs/topics';

/**
 * The page the showcase opens on, how an app starts on the kit, in no group: the Quick start at
 * its own address, and the Tutorial below it, its two sub-pages in the rail.
 */
export const GETTING_STARTED = 'getting-started';

/** The tutorial, from installing Node.js to a first app on the kit. */
export const TUTORIAL = `${GETTING_STARTED}/tutorial`;

/** The page of every result of the docs' search, which gets the search as `q`. */
export const SEARCH = 'search';

// Each page's title goes into the document's (`provideNeatTitles` in app.config.ts).
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: GETTING_STARTED },
  {
    path: GETTING_STARTED,
    title: 'Quick start',
    loadComponent: () => import('./pages/getting-started.page').then((m) => m.GettingStartedPage),
  },
  {
    path: TUTORIAL,
    title: 'Tutorial',
    loadComponent: () => import('./pages/tutorial/tutorial.page').then((m) => m.TutorialPage),
  },
  // Every result of the docs' search, which the top bar's palette links to; no rail item.
  {
    path: SEARCH,
    title: 'Search',
    loadComponent: () => import('./pages/search.page').then((m) => m.SearchPage),
  },
  // Spike only: every state of the message box, for screenshots.
  {
    path: 'msgbox-spike',
    title: 'Message box spike',
    loadComponent: () => import('./pages/msgbox-spike.page').then((m) => m.MsgboxSpikePage),
  },
  // The docs: a page per topic of each group, at its group's or its category's address.
  ...docsRoutes(GROUPS),
  // A mistyped or retired address lands on Getting started, not on a blank page: an address that
  // changed gets no redirect of its own.
  { path: '**', redirectTo: GETTING_STARTED },
];
