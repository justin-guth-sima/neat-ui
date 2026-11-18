import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatStackedChart } from '@sima/neat-ui/charts';
import { RAILS, TIMES, watts } from './data';

/**
 * The board's eight power rails stacked into its total, one band in each series color. The DDR
 * rail did not report for a minute, which breaks the whole stack there. The card sets
 * `--neat-surface` to its fill, for the hairlines between the bands and the labels' halos.
 *
 * @gallery
 */
@Component({
  selector: 'app-power-rails',
  imports: [NeatStackedChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-power-rails.example.html',
  styleUrl: './power-rails.example.css',
})
export class PowerRails {
  protected readonly rails = RAILS;
  protected readonly times = TIMES;
  protected readonly watts = watts;
}
