import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { CLUSTERS, CORES, percent, TIMES } from './data';

/**
 * Three series in `--neat-series-1` to `-3`, listed with their current values. The second chart has
 * ten: it draws the seven with the largest mean and an Other, the sum of the three left, which is
 * a gap wherever one of them is missing.
 *
 * @gallery
 */
@Component({
  selector: 'app-several-series',
  imports: [NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-grid">
      <div class="chart-card">
        <neat-time-chart
          label="Cluster load"
          [series]="clusters"
          [times]="times"
          [domain]="[0, 100]"
          [format]="percent"
        />
      </div>
      <div class="chart-card">
        <neat-time-chart
          label="Ten cores"
          size="large"
          [series]="cores"
          [times]="times"
          [domain]="[0, 100]"
          [format]="percent"
        />
      </div>
    </div>
  `,
  styleUrl: './chart-card.css',
})
export class SeveralSeries {
  protected readonly clusters = CLUSTERS;
  protected readonly cores = CORES;
  protected readonly times = TIMES;
  protected readonly percent = percent;
}
