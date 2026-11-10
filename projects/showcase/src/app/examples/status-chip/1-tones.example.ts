import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatStatusChip, NeatStatusChipButton } from '@sima/neat-ui/status-chip';
import { CHIPS, SURFACES } from './chips';

/**
 * The six tones on the page and on a card, each worded as a stream's slot states are: the words
 * carry the state, the color repeats it. The gray of `neutral` shows on both surfaces.
 *
 * The last chip is a `NeatStatusChipButton`: it looks the same, and opens more about the status,
 * here a video tile's "Metadata late".
 *
 * @gallery
 */
@Component({
  selector: 'app-tones',
  imports: [NeatStatusChip, NeatStatusChipButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (surface of surfaces; track surface) {
      <div class="showcase-row" [class.card]="surface === 'card'">
        @for (chip of chips; track chip.tone) {
          <neat-status-chip [tone]="chip.tone">{{ chip.label }}</neat-status-chip>
        }
        <button neatStatusChip type="button" tone="warning" (click)="opened.set(true)">
          Metadata late
        </button>
      </div>
    }
    @if (opened()) {
      <p class="showcase-muted">The late notice would open here.</p>
    }
  `,
  styleUrl: './surfaces.css',
})
export class Tones {
  protected readonly surfaces = SURFACES;
  protected readonly chips = CHIPS;
  protected readonly opened = signal(false);
}
