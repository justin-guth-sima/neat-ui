import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { percent, ROWS } from './data';

/**
 * `size="compact"` leaves out every label and the time axis, which suits a row among others: a
 * name, the chart taking what is left, and a value, all in the app's own row. The third row has
 * one sample, which is only its dot.
 */
@Component({
  selector: 'app-compact-rows',
  imports: [NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-card rows">
      @for (row of rows; track row.label) {
        <div class="row">
          <span>{{ row.label }}</span>
          <neat-time-chart
            [label]="row.label"
            size="compact"
            headless
            [series]="row.series"
            [times]="row.times"
            [domain]="[0, 100]"
            [format]="percent"
          />
          <span>{{ row.value }}</span>
        </div>
      }
    </div>
  `,
  styleUrls: ['./chart-card.css', './compact-rows.example.css'],
})
export class CompactRows {
  protected readonly percent = percent;
  protected readonly rows = ROWS;
}
