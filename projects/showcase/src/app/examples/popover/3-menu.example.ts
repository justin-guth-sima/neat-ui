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
  template: `
    <neat-popover label="Channel actions" align="end">
      <button
        neatButton
        neatPopoverTrigger
        type="button"
        variant="text"
        iconOnly
        aria-label="Channel actions"
        neatTooltip="Channel actions"
      >
        <neat-icon name="more" />
      </button>
      <ng-template neatPopoverContent>
        <button neatPopoverItem type="button">Rename</button>
        <button neatPopoverItem type="button">Duplicate</button>
        <button neatPopoverItem type="button" disabled>Move…</button>
        <hr neatPopoverDivider />
        <button neatPopoverItem type="button">Delete</button>
      </ng-template>
    </neat-popover>
  `,
})
export class Menu {}
