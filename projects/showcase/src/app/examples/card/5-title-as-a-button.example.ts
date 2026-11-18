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
  templateUrl: './5-title-as-a-button.example.html',
  styleUrl: './card.example.css',
})
export class TitleButtonCardExample {
  protected readonly opened = signal(false);
}
