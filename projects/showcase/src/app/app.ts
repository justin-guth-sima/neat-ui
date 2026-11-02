import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatNavItem, NeatShell } from '@sima/neat-ui';
import { NeatToastHost } from '@sima/neat-ui/toast';
import { GETTING_STARTED } from './app.routes';
import { groupNavItems } from './docs/docs-routes';
import { GROUPS } from './docs/topics';

/**
 * The showcase's own root. `NeatShell` takes the app's name and its navigation (`navItems`), here
 * Getting started and one rail item per group of the docs, and `NeatToastHost` is rendered once,
 * beside the shell. The rail keeps only the kit's theme switch and its control at its bottom; the
 * Rail items example shows an app's own items there.
 */
@Component({
  imports: [NeatShell, NeatToastHost, RouterOutlet],
  selector: 'app-root',
  template: `
    <neat-shell appName="neat-ui showcase" [navItems]="navItems">
      <router-outlet />
    </neat-shell>
    <neat-toast-host />
  `,
})
export class App {
  /** Getting started, then the groups of the docs: Theme, Layout and Components. */
  protected readonly navItems: NeatNavItem[] = [
    { label: 'Getting started', icon: 'info', path: `/${GETTING_STARTED}` },
    ...groupNavItems(GROUPS),
  ];
}
