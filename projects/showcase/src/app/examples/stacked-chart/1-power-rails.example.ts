import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatStackedChart } from '@sima/neat-ui/charts';
import { RAILS, TIMES, watts } from './data';

/**
 * The board's eight power rails stacked into its total, one band in each series colour. The DDR
 * rail did not report for a minute, which breaks the whole stack there. The card sets
 * `--neat-surface` to its fill, for the hairlines between the bands and the labels' halos.
 */
@Component({
  selector: 'app-power-rails',
  imports: [NeatStackedChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <neat-stacked-chart
        label="Where the power goes"
        headline="11.2 W"
        [series]="rails"
        [times]="times"
        [domain]="[0, 16]"
        [format]="watts"
      />
    </div>
  `,
  styleUrl: './power-rails.example.css',
})
export class PowerRails {
  protected readonly rails = RAILS;
  protected readonly times = TIMES;
  protected readonly watts = watts;
}
