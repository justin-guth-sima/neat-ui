import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatIcon, NeatTooltip } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatPopover, NeatPopoverContent, NeatPopoverTrigger } from '@sima/neat-ui/popover';

/**
 * A number field in a panel with `align="end"`, for a trigger at the right edge of a toolbar. The
 * panel lines up with the trigger's end, and opens inward. Focus moves to the field when the panel
 * opens.
 *
 * @capture click [neatPopoverTrigger]
 */
@Component({
  selector: 'app-aligned-to-the-end',
  imports: [
    NeatButton,
    NeatIcon,
    NeatInput,
    NeatPopover,
    NeatPopoverContent,
    NeatPopoverTrigger,
    NeatTooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-aligned-to-the-end.example.html',
  styleUrl: './popover-fields.css',
})
export class AlignedToTheEnd {
  protected readonly open = signal(false);
  protected readonly channel = signal('');
}
