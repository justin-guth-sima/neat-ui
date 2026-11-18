import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatTimeChart } from '@sima/neat-ui/charts';
import { celsius, TEMPERATURE, TEMPERATURE_THRESHOLDS, TIMES } from './data';

/**
 * A single series in the warning color (`tone="warning"`), on a domain that starts at 40 so the
 * range that matters fills the box. The gap is a daemon that did not answer for a while: a missing
 * sample breaks the line.
 */
@Component({
  selector: 'app-mla-temperature',
  imports: [NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-mla-temperature.example.html',
  styleUrl: './chart-card.css',
})
export class MLATemperature {
  protected readonly series = TEMPERATURE;
  protected readonly times = TIMES;
  protected readonly thresholds = TEMPERATURE_THRESHOLDS;
  protected readonly celsius = celsius;
}
