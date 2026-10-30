import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatIcon, NeatNavItem, NeatRailDivider, NeatRailItem, NeatShell } from '@sima/neat-ui';
import { NeatToastHost, NeatToasts } from '@sima/neat-ui/toast';

@Component({
  imports: [NeatIcon, NeatRailDivider, NeatRailItem, NeatShell, NeatToastHost, RouterOutlet],
  selector: 'app-root',
  template: `
    <neat-shell appName="neat-ui showcase" [navItems]="navItems">
      <!-- The app's own items at the bottom of the rail, above the kit's theme switch. The board
           says its state with the item's tone, text and detail; its label is the whole sentence,
           the tooltip and the name. -->
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
        label="Demo board, 192.168.1.20, connected"
        text="Demo board"
        detail="192.168.1.20"
        tone="success"
        (click)="toasts.status('A board item would open its dialog here.')"
      >
        <neat-icon name="board" />
      </button>
      <!-- Sets the board apart from the items below it, as the kit's line above the group does. -->
      <hr neatRailEnd neatRailDivider />
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
