import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatNavItem, NeatShell } from '@sima/neat-ui';
import { NeatToastHost } from '@sima/neat-ui/toast';

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
  protected readonly navItems: NeatNavItem[] = [
    { label: 'Theme', icon: 'palette', path: '/theme' },
    { label: 'Icons', icon: 'shapes', path: '/icons' },
    { label: 'Components', icon: 'blocks', path: '/components' },
    { label: 'Page', icon: 'document', path: '/page' },
  ];
}
