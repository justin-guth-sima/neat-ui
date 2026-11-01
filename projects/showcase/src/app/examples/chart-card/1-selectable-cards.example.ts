import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatChartCard, NeatSparkline, NeatTimeChart } from '@sima/neat-ui/charts';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';
import { celsius, CPU, CPU_THRESHOLDS, percent, TEMPERATURE, TIMES } from './data';

/**
 * Three selectable cards and one that is not; the readout says which is chosen. Click the first
 * card's chart, not only its heading, to choose it. The second holds a chip and a sparkline, the
 * third has nothing to show, and the fourth takes no click.
 */
@Component({
  selector: 'app-selectable-cards',
  imports: [NeatChartCard, NeatSparkline, NeatStatusChip, NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid">
      <neat-chart-card
        heading="CPU usage"
        value="34"
        unit="%"
        caption="All cores"
        selectable
        [selected]="chosen() === 'cpu'"
        (activate)="chosen.set('cpu')"
      >
        <neat-time-chart
          label="CPU usage"
          headless
          [valueLabels]="false"
          [series]="cpu"
          [times]="times"
          [domain]="[0, 100]"
          [thresholds]="thresholds"
          [format]="percent"
        />
      </neat-chart-card>
      <neat-chart-card
        heading="MLA temperature"
        value="78.2"
        unit="°C"
        caption="Hottest of 8 sensors"
        selectable
        [selected]="chosen() === 'mla'"
        (activate)="chosen.set('mla')"
      >
        <neat-status-chip neatChartCardChip tone="warning">Warning</neat-status-chip>
        <neat-sparkline
          label="MLA temperature"
          tone="warning"
          [values]="temperature"
          [format]="celsius"
        />
      </neat-chart-card>
      <neat-chart-card
        heading="Fan speed"
        value="Not reported"
        caption="The board does not report it"
        selectable
        [selected]="chosen() === 'fan'"
        (activate)="chosen.set('fan')"
      />
      <neat-chart-card heading="Board power" value="11.4" unit="W" caption="Now" />
    </div>
    <p class="chosen showcase-code showcase-muted">Chosen: {{ chosen() }}</p>
  `,
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
