import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatSeriesSwatch } from '@sima/neat-ui';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { percent, RUNS, TIMES } from './data';

/**
 * A chip for each of three compared runs, over the chart that draws them. The chip's swatch is the
 * run's place in `series`, so it matches the run's line in both themes.
 *
 * @gallery
 */
@Component({
  selector: 'app-run-chips',
  imports: [NeatSeriesSwatch, NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <ul class="chips" aria-label="Compared runs">
        @for (run of runs; track run.key) {
          <li><neat-series-swatch [index]="$index" />{{ run.label }}</li>
        }
      </ul>
      <neat-time-chart
        label="Load by run"
        headless
        [series]="runs"
        [times]="times"
        [domain]="[0, 100]"
        [format]="percent"
      />
    </div>
  `,
  styleUrl: './run-chips.example.css',
})
export class RunChips {
  protected readonly runs = RUNS;
  protected readonly times = TIMES;
  protected readonly percent = percent;
}
