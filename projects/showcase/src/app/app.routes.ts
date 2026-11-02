import { Routes } from '@angular/router';
import { docsRoutes } from './docs/docs-routes';
import { GROUPS } from './docs/topics';

/** The page the showcase opens on, how an app starts on the kit: no group, so no tabs. */
export const GETTING_STARTED = 'getting-started';

// Each page's title goes into the document's (`provideNeatTitles` in app.config.ts).
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: GETTING_STARTED },
  {
    path: GETTING_STARTED,
    title: 'Getting started',
    loadComponent: () => import('./pages/getting-started.page').then((m) => m.GettingStartedPage),
  },
  // The docs: a page per topic of each group, and the old addresses of Components' categories.
  ...docsRoutes(GROUPS),
  // A mistyped or retired address lands on Getting started, not on a blank page.
  { path: '**', redirectTo: GETTING_STARTED },
];
