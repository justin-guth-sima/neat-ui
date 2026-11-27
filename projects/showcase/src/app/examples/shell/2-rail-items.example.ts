import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  NeatBoardItem,
  NeatIcon,
  NeatNavItem,
  NeatRailDivider,
  NeatRailItem,
  NeatShell,
} from '@sima/neat-ui';
import { LayoutDashboard } from '@sima/neat-ui/lucide';
import { NeatToasts } from '@sima/neat-ui/toast';

/**
 * The app's own items at the bottom of the rail, in a shell of their own.
 *
 * Each element marked `neatRailEnd` goes in the rail's end slot, above the kit's theme switch and
 * the rail's control. They are `NeatRailItem`s, and a `NeatRailDivider` between groups of them.
 *
 * The board is the kit's `NeatBoardItem`, which words its state itself from the connection. The
 * devices after it say theirs with the rail item's `tone`, `text` and `detail`, one per tone. Each
 * device's `label` is the whole sentence: its tooltip and its name.
 *
 * The first page has `children`, which unfold under it while it is the active page and the rail is
 * expanded. Its `icon` is a Lucide glyph, as a page takes one where no name of the kit's set fits.
 *
 * @page
 */
@Component({
  selector: 'app-rail-items',
  imports: [NeatBoardItem, NeatIcon, NeatRailDivider, NeatRailItem, NeatShell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-rail-items.example.html',
})
export class RailItems {
  protected readonly toasts = inject(NeatToasts);
  /**
   * The app's pages: here this example alone, with three sub-pages to show the rail's second
   * level. All stay under the example's own route, which serves its sub-paths with the same example, so a
   * press changes the URL and the open sub-page without leaving the docs. The first sub-page has
   * the page's own path, so the page needs no redirect.
   */
  protected readonly navItems: NeatNavItem[] = [
    {
      label: 'Rail items',
      icon: LayoutDashboard,
      path: '/demo/shell/rail-items',
      children: [
        { label: 'Overview', path: '/demo/shell/rail-items' },
        { label: 'Devices', path: '/demo/shell/rail-items/devices' },
        { label: 'Settings', path: '/demo/shell/rail-items/settings' },
      ],
    },
  ];
}
