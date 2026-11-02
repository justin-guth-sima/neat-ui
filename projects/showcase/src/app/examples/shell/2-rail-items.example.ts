import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NeatIcon, NeatNavItem, NeatRailDivider, NeatRailItem, NeatShell } from '@sima/neat-ui';
import { NeatToasts } from '@sima/neat-ui/toast';

/**
 * The app's own items at the bottom of the rail, in a shell of their own. Each element marked
 * `neatRailEnd` goes in the rail's end slot, above the kit's theme switch and the rail's control:
 * `NeatRailItem`s, and a `NeatRailDivider` between groups of them. The board says its state with
 * the item's `tone`, `text` and `detail`, and the devices after it show the other tones; each
 * item's `label` is the whole sentence, its tooltip and its name. The first page has `children`,
 * which unfold under it while it is the active page and the rail is expanded.
 *
 * @page
 */
@Component({
  selector: 'app-rail-items',
  imports: [NeatIcon, NeatRailDivider, NeatRailItem, NeatShell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-shell appName="Demo app" [navItems]="navItems">
      <button
        neatRailEnd
        neatRailItem
        type="button"
        label="About this app"
        (click)="toasts.status('An about item would open its dialog here.')"
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
      <!-- Sets the devices apart from the items below them, as the kit's line above the group
           does. -->
      <hr neatRailEnd neatRailDivider />
    </neat-shell>
  `,
})
export class RailItems {
  protected readonly toasts = inject(NeatToasts);
  /**
   * The app's pages: here this example, with three sub-pages to show the rail's second level, and
   * the shell's docs. The first sub-page has the page's own path, so the page needs no redirect.
   */
  protected readonly navItems: NeatNavItem[] = [
    {
      label: 'Rail items',
      icon: 'viewer',
      path: '/demo/shell/rail-items',
      children: [
        { label: 'Overview', path: '/demo/shell/rail-items' },
        { label: 'Devices', path: '/demo/shell/rail-items/devices' },
        { label: 'Settings', path: '/demo/shell/rail-items/settings' },
      ],
    },
    { label: 'Shell docs', icon: 'document', path: '/layout/shell' },
  ];
}
