import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { CPU, percent, TIMES } from './data';

/**
 * `axis="elapsed"` counts the x axis forward from the first sample ("0 s … 8 min"), for a run read
 * from its start. The default counts back from the newest sample.
 */
@Component({
  selector: 'app-elapsed-axis',
  imports: [NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-elapsed-axis.example.html',
  styleUrl: './chart-card.css',
})
export class ElapsedAxis {
  protected readonly series = CPU;
  protected readonly times = TIMES;
  protected readonly percent = percent;
}
