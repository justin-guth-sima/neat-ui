import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { CLUSTERS, CORES, percent, TIMES } from './data';

/**
 * Three series in `--neat-series-1` to `-3`, listed with their current values.
 *
 * The second chart has ten. It draws the seven with the largest mean, and an Other, the sum of the
 * three left. Other is a gap wherever one of them is missing.
 *
 * @gallery
 */
@Component({
  selector: 'app-several-series',
  imports: [NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-several-series.example.html',
  styleUrl: './chart-card.css',
})
export class SeveralSeries {
  protected readonly clusters = CLUSTERS;
  protected readonly cores = CORES;
  protected readonly times = TIMES;
  protected readonly percent = percent;
}
