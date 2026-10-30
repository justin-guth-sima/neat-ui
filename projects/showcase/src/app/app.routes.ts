import { Routes } from '@angular/router';

// Each page's title goes into the document's (`provideNeatTitles` in app.config.ts).
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'theme' },
  {
    path: 'theme',
    title: 'Theme',
    loadComponent: () => import('./pages/theme.page').then((m) => m.ThemePage),
  },
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
  {
    path: 'charts',
    title: 'Charts',
    loadComponent: () => import('./pages/charts.page').then((m) => m.ChartsPage),
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
