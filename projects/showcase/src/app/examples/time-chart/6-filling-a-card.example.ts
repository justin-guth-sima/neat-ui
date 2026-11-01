import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { CORES, MLA, percent, TIMES } from './data';

/**
 * `size="fill"` for a chart whose host the app gives a height: two cards on one row, which stretches
 * the shorter to the taller one's height, and the chart on the right takes the height left, never
 * under the medium plot's.
 */
@Component({
  selector: 'app-filling-a-card',
  imports: [NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-grid">
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
      <div class="chart-card fill">
        <neat-time-chart
          label="MLA usage"
          headline="62%"
          size="fill"
          [series]="mla"
          [times]="times"
          [domain]="[0, 100]"
          [format]="percent"
        />
      </div>
    </div>
  `,
  styleUrls: ['./chart-card.css', './filling-a-card.example.css'],
})
export class FillingACard {
  protected readonly cores = CORES;
  protected readonly mla = MLA;
  protected readonly times = TIMES;
  protected readonly percent = percent;
}
