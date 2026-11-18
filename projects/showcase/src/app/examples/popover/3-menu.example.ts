import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, NeatIcon, NeatTooltip } from '@sima/neat-ui';
import {
  NeatPopover,
  NeatPopoverContent,
  NeatPopoverDivider,
  NeatPopoverItem,
  NeatPopoverTrigger,
} from '@sima/neat-ui/popover';

/**
 * A ⋯ menu: the rows are `neatPopoverItem` buttons, a `neatPopoverDivider` sets the destructive
 * one apart, and a disabled row keeps its place. The first enabled row takes the focus when the
 * menu opens.
 *
 * @capture click [neatPopoverTrigger]
 * @gallery
 */
@Component({
  selector: 'app-menu',
  imports: [
    NeatButton,
    NeatIcon,
    NeatPopover,
    NeatPopoverContent,
    NeatPopoverDivider,
    NeatPopoverItem,
    NeatPopoverTrigger,
    NeatTooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-menu.example.html',
})
export class Menu {}
