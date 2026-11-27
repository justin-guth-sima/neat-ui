import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatFigure, NeatNumeric, NeatTable } from '@sima/neat-ui/table';
import { NeatBadge } from '@sima/neat-ui/badge';

/**
 * The metrics of a run.
 *
 * The Mean column is end-aligned (`neatNumeric`). The Max column is not, since each of its figures
 * is followed by a badge (`neatFigure`). The figure and the badge stay on one line while there
 * is room.
 *
 * @gallery
 */
@Component({
  selector: 'app-run-metrics',
  imports: [NeatFigure, NeatNumeric, NeatBadge, NeatTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-run-metrics.example.html',
  styleUrl: './run-metrics.example.css',
})
export class RunMetrics {
  protected readonly metrics = [
    { name: 'Board power', mean: '7.9 W', max: '12.51 W', tone: 'success', status: 'OK' },
    { name: 'SoC temperature', mean: '61.2 °C', max: '84.0 °C', tone: 'warning', status: 'Warm' },
    { name: 'Memory used', mean: '2.1 GiB', max: '2.4 GiB', tone: 'success', status: 'OK' },
  ] as const;
}
