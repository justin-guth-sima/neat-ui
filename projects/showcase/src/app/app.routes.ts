import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'theme' },
  { path: 'theme', loadComponent: () => import('./pages/theme.page').then((m) => m.ThemePage) },
  { path: 'icons', loadComponent: () => import('./pages/icons.page').then((m) => m.IconsPage) },
  {
    path: 'components',
    loadComponent: () => import('./pages/components.page').then((m) => m.ComponentsPage),
  },
  { path: 'charts', loadComponent: () => import('./pages/charts.page').then((m) => m.ChartsPage) },
  { path: 'page', loadComponent: () => import('./pages/page.page').then((m) => m.PagePage) },
  // The same page on a second route, for the page tabs' demo to link to.
  {
    path: 'page/details',
    loadComponent: () => import('./pages/page.page').then((m) => m.PagePage),
  },
];
