import { Routes } from '@angular/router';
import { docsRoutes, topicPath } from './docs/docs-routes';
import { GROUPS } from './docs/topics';

// Each page's title goes into the document's (`provideNeatTitles` in app.config.ts).
export const routes: Routes = [
  // The first topic of the first group, not the group: one redirect only is followed per level.
  { path: '', pathMatch: 'full', redirectTo: topicPath(GROUPS[0], GROUPS[0].topics[0]) },
  // The docs: a page per topic of each group, the theme's among them.
  ...docsRoutes(GROUPS),
  // An address of the old pages, or a mistyped one, lands on the docs' first page, not a blank one.
  { path: '**', redirectTo: topicPath(GROUPS[0], GROUPS[0].topics[0]) },
];
