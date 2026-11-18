import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { CPU, CPU_THRESHOLDS, percent, TIMES } from './data';

/**
 * One series with a warning and a critical threshold, the headline beside the title. The app
 * fixes the domain, 0 to 100 for a percentage, so the line never rescales under the reader. The
 * card sets `--neat-surface` to its fill, for the labels' halos.
 */
@Component({
  selector: 'app-cpu-usage',
  imports: [NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-cpu-usage.example.html',
  styleUrl: './chart-card.css',
})
export class CPUUsage {
  protected readonly series = CPU;
  protected readonly times = TIMES;
  protected readonly thresholds = CPU_THRESHOLDS;
  protected readonly percent = percent;
}
