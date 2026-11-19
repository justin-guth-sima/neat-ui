import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, NeatExpand, NeatIcon } from '@sima/neat-ui';
import { NeatCard } from '@sima/neat-ui/card';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { MLA_USAGE, percent, TIMES } from './data';

/**
 * A card shown over the whole window from the button in its header, and put back from the same
 * button. Its chart takes the window's height.
 *
 * Press Expand, then Close or Escape. The button sits inside the card, which covers the page while
 * expanded.
 */
@Component({
  selector: 'app-expanding-a-card',
  imports: [NeatButton, NeatCard, NeatExpand, NeatIcon, NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-expanding-a-card.example.html',
  styleUrl: './expanding-a-card.example.css',
})
export class ExpandingACard {
  protected readonly usage = MLA_USAGE;
  protected readonly times = TIMES;
  protected readonly percent = percent;
}
