import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCard } from '@sima/neat-ui/card';
import { NeatScoreBars } from '@sima/neat-ui/charts';
import { CLASSES, NO_GESTURE, scoresAt } from './data';

/**
 * The same scores in a card 24 rem tall, as beside a video whose height the card takes. With
 * `size="fill"` the bars share the height the card leaves its content: each row grows, its label
 * and figure stay centred, and its bar thickens up to twice its usual thickness. In a box shorter
 * than the rows need, they keep their usual height and the list overflows.
 */
@Component({
  selector: 'app-filling-a-card',
  imports: [NeatCard, NeatScoreBars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-card title="Probabilities">
      <neat-score-bars
        label="Gesture probabilities"
        size="fill"
        [scores]="scores"
        [labels]="labels"
        [quiet]="quiet"
      />
    </neat-card>
  `,
  styleUrl: './filling-a-card.example.css',
})
export class FillingACard {
  protected readonly labels = CLASSES;
  protected readonly quiet = [NO_GESTURE];
  protected readonly scores = scoresAt(3);
}
