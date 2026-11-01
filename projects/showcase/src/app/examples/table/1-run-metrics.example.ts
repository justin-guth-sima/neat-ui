import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatFigure, NeatNumeric, NeatTable } from '@sima/neat-ui/table';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';

/**
 * The metrics of a run. The Mean column is end-aligned (`neatNumeric`); the Max column is not,
 * since each of its figures is followed by a status chip (`neatFigure`), and the figure and the
 * chip stay on one line while there is room.
 */
@Component({
  selector: 'app-run-metrics',
  imports: [NeatFigure, NeatNumeric, NeatStatusChip, NeatTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table neatTable aria-label="Metrics of a run">
      <thead>
        <tr>
          <th scope="col">Metric</th>
          <th scope="col" neatNumeric>Mean</th>
          <th scope="col" neatFigure>Max</th>
        </tr>
      </thead>
      <tbody>
        @for (metric of metrics; track metric.name) {
          <tr>
            <th scope="row">{{ metric.name }}</th>
            <td neatNumeric>{{ metric.mean }}</td>
            <td neatFigure>
              <div class="max">
                {{ metric.max }}
                <neat-status-chip [tone]="metric.tone">{{ metric.status }}</neat-status-chip>
              </div>
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styleUrl: './run-metrics.example.css',
})
export class RunMetrics {
  protected readonly metrics = [
    { name: 'Board power', mean: '7.9 W', max: '12.51 W', tone: 'success', status: 'OK' },
    { name: 'SoC temperature', mean: '61.2 °C', max: '84.0 °C', tone: 'warning', status: 'Warm' },
    { name: 'Memory used', mean: '2.1 GiB', max: '2.4 GiB', tone: 'success', status: 'OK' },
  ] as const;
}
