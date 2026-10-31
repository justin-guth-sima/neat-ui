import { Routes } from '@angular/router';

// Each renderer is a lazy route of its own, so its code is a chunk of its own: the harness tells
// the kit host's long frames from the vflow host's by the chunk a script came from.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Start',
    loadComponent: () => import('./start.page').then((m) => m.StartPage),
  },
  {
    path: 'kit',
    title: 'Kit',
    loadComponent: () => import('./hosts/kit-host').then((m) => m.KitHost),
  },
  {
    path: 'vflow',
    title: 'vflow',
    loadComponent: () => import('./hosts/vflow-host').then((m) => m.VflowHost),
  },
  {
    path: 'none',
    title: 'None',
    loadComponent: () => import('./hosts/none-host').then((m) => m.NoneHost),
  },
  {
    path: 'results',
    title: 'Results',
    loadComponent: () => import('./results/results-view').then((m) => m.ResultsView),
  },
];
