import { Routes } from '@angular/router';
import { About } from './about/about';
import { Streams } from './streams/streams';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'streams' },
  { path: 'streams', title: 'Streams', component: Streams },
  { path: 'about', title: 'About', component: About },
];
