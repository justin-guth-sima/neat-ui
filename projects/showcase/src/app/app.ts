import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatIcon, NeatNavItem, NeatRailItem, NeatShell } from '@sima/neat-ui';
import { NeatToastHost, NeatToasts } from '@sima/neat-ui/toast';

@Component({
  imports: [NeatIcon, NeatRailItem, NeatShell, NeatToastHost, RouterOutlet],
  selector: 'app-root',
  template: `
    <neat-shell appName="neat-ui showcase" [navItems]="navItems">
      <!-- The app's own items at the bottom of the rail, above the kit's theme switch. -->
      <button
        neatRailEnd
        neatRailItem
        type="button"
        label="About this showcase"
        (click)="toasts.status('The rail is the app’s: its items sit at its bottom.')"
      >
        <neat-icon name="info" />
      </button>
      <button
        neatRailEnd
        neatRailItem
        type="button"
        label="Demo board, 192.168.1.20"
        (click)="toasts.status('A board item would open its dialog here.')"
      >
        <neat-icon name="board" />
        <span neatRailItemLabel class="showcase-rail-lines">
          Demo board <small>192.168.1.20</small>
        </span>
      </button>
      <router-outlet />
    </neat-shell>
    <neat-toast-host />
  `,
})
export class App {
  protected readonly toasts = inject(NeatToasts);
  protected readonly navItems: NeatNavItem[] = [
    { label: 'Theme', icon: 'palette', path: '/theme' },
    { label: 'Icons', icon: 'shapes', path: '/icons' },
    { label: 'Components', icon: 'blocks', path: '/components' },
    { label: 'Charts', icon: 'stats', path: '/charts' },
    { label: 'Page', icon: 'document', path: '/page' },
  ];
}
