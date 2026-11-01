import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatIcon, NeatTooltip } from '@sima/neat-ui';
import { NeatPopover, NeatPopoverContent, NeatPopoverTrigger } from '@sima/neat-ui/popover';
import { NeatSwitch } from '@sima/neat-ui/switch';

/**
 * A panel of view options below an icon-only trigger. `[(open)]` follows the trigger, Escape and
 * outside clicks, and the switches' values live in the page, since the content is created on
 * opening and destroyed on closing: reopen the panel and they are as they were.
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
  template: `
    <neat-popover label="View options" [(open)]="open">
      <button
        neatButton
        neatPopoverTrigger
        type="button"
        variant="text"
        iconOnly
        aria-label="View options"
        neatTooltip="View options"
      >
        <neat-icon name="more" />
      </button>
      <ng-template neatPopoverContent>
        <div class="popover-fields">
          <button neatSwitch [(checked)]="bars">Bars</button>
          <button neatSwitch [(checked)]="hideEmpty">Hide empty slots</button>
        </div>
      </ng-template>
    </neat-popover>
    <p class="showcase-code showcase-muted">
      View options {{ open() ? 'open' : 'closed' }}; bars {{ bars() ? 'on' : 'off' }}, empty slots
      {{ hideEmpty() ? 'hidden' : 'shown' }}
    </p>
  `,
  styleUrl: './popover-fields.css',
})
export class SwitchesInAPanel {
  protected readonly open = signal(false);
  protected readonly bars = signal(true);
  protected readonly hideEmpty = signal(false);
}
