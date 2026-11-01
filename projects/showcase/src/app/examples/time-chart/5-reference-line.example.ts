import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { POWER, POWER_AVERAGE, TIMES, watts } from './data';

/**
 * A reference is a level that is neither a warning nor a danger, here the session's average, drawn
 * dashed in the quiet colour.
 */
@Component({
  selector: 'app-reference-line',
  imports: [NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-card">
      <neat-time-chart
        label="Board power"
        headline="11.4 W"
        size="large"
        [series]="series"
        [times]="times"
        [domain]="[0, 16]"
        [reference]="average"
        [format]="watts"
      />
    </div>
  `,
  styleUrl: './chart-card.css',
})
export class ReferenceLine {
  protected readonly series = POWER;
  protected readonly times = TIMES;
  protected readonly average = POWER_AVERAGE;
  protected readonly watts = watts;
}
