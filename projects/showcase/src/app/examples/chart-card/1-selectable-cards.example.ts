import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatChartCard, NeatSparkline, NeatTimeChart } from '@sima/neat-ui/charts';
import { NeatBadge } from '@sima/neat-ui/badge';
import { celsius, CPU, CPU_THRESHOLDS, percent, TEMPERATURE, TIMES } from './data';

/**
 * Three selectable cards and one that is not; the readout says which is chosen. Click the first
 * card's chart, not only its heading, to choose it. The second holds a badge and a sparkline, the
 * third has nothing to show, and the fourth takes no click.
 *
 * @gallery
 */
@Component({
  selector: 'app-selectable-cards',
  imports: [NeatChartCard, NeatSparkline, NeatBadge, NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-selectable-cards.example.html',
  styleUrl: './selectable-cards.example.css',
})
export class SelectableCards {
  protected readonly chosen = signal('cpu');
  protected readonly cpu = CPU;
  protected readonly thresholds = CPU_THRESHOLDS;
  protected readonly temperature = TEMPERATURE;
  protected readonly times = TIMES;
  protected readonly percent = percent;
  protected readonly celsius = celsius;
}
