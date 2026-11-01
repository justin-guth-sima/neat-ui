import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NeatIcon, NeatNavItem, NeatRailDivider, NeatRailItem, NeatShell } from '@sima/neat-ui';
import { NeatToastHost, NeatToasts } from '@sima/neat-ui/toast';
import { groupNavItems } from './docs/docs-routes';
import { GROUPS } from './docs/topics';

/**
 * The showcase's own root. `NeatShell` takes the app's name and its navigation (`navItems`), here
 * one rail item per group of the docs. The app's own items go at the bottom of the rail with
 * `neatRailEnd` (`NeatRailItem`, and `NeatRailDivider` between groups of them), above the kit's
 * theme switch, and `NeatToastHost` is rendered once, beside the shell.
 */
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
      <!-- The other tones, so each dot and detail colour can be checked by eye on the rail. -->
      <button
        neatRailEnd
        neatRailItem
        type="button"
        label="Front camera, reconnecting"
        text="Front camera"
        detail="Reconnecting"
        tone="warning"
        (click)="toasts.status('A device item would open its dialog here.')"
      >
        <neat-icon name="camera" />
      </button>
      <button
        neatRailEnd
        neatRailItem
        type="button"
        label="Lidar, no data"
        text="Lidar"
        detail="No data"
        tone="danger"
        (click)="toasts.status('A device item would open its dialog here.')"
      >
        <neat-icon name="lidar" />
      </button>
      <button
        neatRailEnd
        neatRailItem
        type="button"
        label="Microphone, idle"
        text="Microphone"
        detail="Idle"
        tone="neutral"
        (click)="toasts.status('A device item would open its dialog here.')"
      >
        <neat-icon name="microphone" />
      </button>
      <!--
        Sets the devices apart from the items below them, as the kit's line above the group does.
      -->
      <hr neatRailEnd neatRailDivider />
      <router-outlet />
    </neat-shell>
    <neat-toast-host />
  `,
})
export class App {
  protected readonly toasts = inject(NeatToasts);
  /** The groups of the docs, the theme first, then the old pages. */
  protected readonly navItems: NeatNavItem[] = [
    ...groupNavItems(GROUPS),
    { label: 'Icons', icon: 'shapes', path: '/icons' },
    { label: 'Components', icon: 'blocks', path: '/components' },
    { label: 'Page', icon: 'document', path: '/page' },
    { label: 'Charts (old)', icon: 'stats', path: '/legacy/charts' },
    { label: 'Diagram (old)', icon: 'device', path: '/legacy/diagram' },
  ];
}
