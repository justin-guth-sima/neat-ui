import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { percent, ROWS } from './data';

/**
 * `size="compact"` leaves out every label and the time axis, which suits a row among others.
 *
 * Each row is the app's own: a name, the chart taking what is left, and a value. The third row has
 * one sample, which is only its dot.
 */
@Component({
  selector: 'app-compact-rows',
  imports: [NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './7-compact-rows.example.html',
  styleUrls: ['./chart-card.css', './compact-rows.example.css'],
})
export class CompactRows {
  protected readonly percent = percent;
  protected readonly rows = ROWS;
}
