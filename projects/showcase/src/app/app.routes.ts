import { Routes } from '@angular/router';
import { docsRoutes } from './docs/docs-routes';
import { GROUPS } from './docs/topics';

// Each page's title goes into the document's (`provideNeatTitles` in app.config.ts).
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'theme' },
  {
    path: 'theme',
    title: 'Theme',
    loadComponent: () => import('./pages/theme.page').then((m) => m.ThemePage),
  },
  // The generated docs: a page per topic of each group, which replace the old pages one by one.
  ...docsRoutes(GROUPS),
  {
    path: 'icons',
    title: 'Icons',
    loadComponent: () => import('./pages/icons.page').then((m) => m.IconsPage),
  },
  {
    path: 'components',
    title: 'Components',
    loadComponent: () => import('./pages/components.page').then((m) => m.ComponentsPage),
  },
  // The old pages whose names a group of the docs has taken, kept while topics move off them.
  {
    path: 'legacy/charts',
    title: 'Charts (old)',
    loadComponent: () => import('./pages/charts.page').then((m) => m.ChartsPage),
  },
  {
    path: 'legacy/diagram',
    title: 'Diagram (old)',
    loadComponent: () => import('./pages/diagram.page').then((m) => m.DiagramPage),
  },
  {
    path: 'page',
    title: 'Page',
    loadComponent: () => import('./pages/page.page').then((m) => m.PagePage),
  },
  // The same page on a second route, for the page tabs' demo to link to.
  {
    path: 'page/details',
    title: 'Page details',
    loadComponent: () => import('./pages/page.page').then((m) => m.PagePage),
  },
];
