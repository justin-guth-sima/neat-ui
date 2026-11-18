import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCard } from '@sima/neat-ui/card';

/**
 * A card with actions and no title: they still sit at the header's end, and the card is no
 * region.
 */
@Component({
  selector: 'app-actions-only-card',
  imports: [NeatButton, NeatCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-actions-only.example.html',
  styleUrl: './card.example.css',
})
export class ActionsOnlyCardExample {}
