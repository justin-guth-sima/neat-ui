import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatIcon, NeatTooltip } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatPopover, NeatPopoverContent, NeatPopoverTrigger } from '@sima/neat-ui/popover';

/**
 * A number field in a panel with `align="end"`, for a trigger at the right edge of a toolbar: the
 * panel lines up with the trigger's end and opens inward. Focus moves to the field when the panel
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
  template: `
    <neat-popover label="Go to channel" align="end" [(open)]="open">
      <button
        neatButton
        neatPopoverTrigger
        type="button"
        variant="text"
        iconOnly
        aria-label="Go to channel"
        neatTooltip="Go to channel"
      >
        <neat-icon name="search" />
      </button>
      <ng-template neatPopoverContent>
        <div class="popover-fields">
          <label class="popover-fields">
            <span>Channel</span>
            <input
              #field
              neatInput
              size="small"
              type="number"
              inputmode="numeric"
              min="0"
              max="15"
              placeholder="0–15"
              aria-describedby="channel-hint"
              [value]="channel()"
              (input)="channel.set(field.value)"
            />
          </label>
          <span id="channel-hint" class="showcase-muted">Aligned to the trigger's end edge.</span>
        </div>
      </ng-template>
    </neat-popover>
    <p class="showcase-code showcase-muted">
      Go to channel {{ open() ? 'open' : 'closed' }}; channel {{ channel() || 'none' }}
    </p>
  `,
  styleUrl: './popover-fields.css',
})
export class AlignedToTheEnd {
  protected readonly open = signal(false);
  protected readonly channel = signal('');
}
