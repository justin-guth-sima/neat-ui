import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatCard } from '@sima/neat-ui/card';

/**
 * A card whose title is a button, projected with `neatCardTitle` in place of the title's text: a
 * card that opens its detail. Without a `title` the card has no heading role, so the button is
 * the card's name as a control.
 */
@Component({
  selector: 'app-title-button-card',
  imports: [NeatCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-card subtitle="Click the title">
      <button type="button" neatCardTitle class="title-button" (click)="opened.set(!opened())">
        Detections
      </button>
      <p>{{ opened() ? 'Opened.' : 'Closed.' }}</p>
    </neat-card>
  `,
  styleUrl: './card.example.css',
})
export class TitleButtonCardExample {
  protected readonly opened = signal(false);
}
