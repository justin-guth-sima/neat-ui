import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatIcon, NeatTooltip } from '@sima/neat-ui';
import { NeatPopover, NeatPopoverContent, NeatPopoverTrigger } from '@sima/neat-ui/popover';
import { NeatSwitch } from '@sima/neat-ui/switch';

/**
 * A panel of view options below an icon-only trigger. `[(open)]` follows the trigger, Escape and
 * outside clicks.
 *
 * The switches' values live in the page, since the content is created on opening and destroyed on
 * closing. Try reopening the panel: they are as they were.
 *
 * @capture click [neatPopoverTrigger]
 */
@Component({
  selector: 'app-switches-in-a-panel',
  imports: [
    NeatButton,
    NeatIcon,
    NeatPopover,
    NeatPopoverContent,
    NeatPopoverTrigger,
    NeatSwitch,
    NeatTooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-switches-in-a-panel.example.html',
  styleUrl: './popover-fields.css',
})
export class SwitchesInAPanel {
  protected readonly open = signal(false);
  protected readonly bars = signal(true);
  protected readonly hideEmpty = signal(false);
}
