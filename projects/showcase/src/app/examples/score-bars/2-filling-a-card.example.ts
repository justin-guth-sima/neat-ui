import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCard } from '@sima/neat-ui/card';
import { NeatScoreBars } from '@sima/neat-ui/charts';
import { CLASSES, NO_GESTURE, scoresAt } from './data';

/**
 * The same scores in a card 24 rem tall, as beside a video whose height the card takes.
 *
 * With `size="fill"`, the bars share the height the card leaves its content. Each row grows, its
 * label and figure stay centered, and its bar thickens, up to twice its usual thickness. In a box
 * shorter than the rows need, they keep their usual height, and the list overflows.
 */
@Component({
  selector: 'app-filling-a-card',
  imports: [NeatCard, NeatScoreBars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-filling-a-card.example.html',
  styleUrl: './filling-a-card.example.css',
})
export class FillingACard {
  protected readonly labels = CLASSES;
  protected readonly quiet = [NO_GESTURE];
  protected readonly scores = scoresAt(3);
}
