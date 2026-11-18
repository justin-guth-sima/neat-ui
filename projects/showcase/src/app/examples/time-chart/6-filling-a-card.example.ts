import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { CORES, MLA, percent, TIMES } from './data';

/**
 * `size="fill"`, for a chart whose host the app gives a height.
 *
 * Two cards sit on one row, which stretches the shorter to the taller one's height. The chart on
 * the right takes the height left, never under the medium plot's.
 */
@Component({
  selector: 'app-filling-a-card',
  imports: [NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './6-filling-a-card.example.html',
  styleUrls: ['./chart-card.css', './filling-a-card.example.css'],
})
export class FillingACard {
  protected readonly cores = CORES;
  protected readonly mla = MLA;
  protected readonly times = TIMES;
  protected readonly percent = percent;
}
