import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatGauge } from '@sima/neat-ui/gauge';
import { SENSORS, TEMPERATURE_ZONES } from './data';

/**
 * Three temperatures from 0 to 110 °C, with a warning zone from 85 °C and a danger zone from
 * 100 °C. The first is below both, so its arc keeps the line color; the second is in warning and
 * its arc turns orange, the third in danger and its arc turns red, which each gauge also says in
 * words. On their own, they show their label as a title.
 */
@Component({
  selector: 'app-with-zones',
  imports: [NeatGauge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-with-zones.example.html',
  styleUrl: './with-zones.example.css',
})
export class WithZones {
  protected readonly sensors = SENSORS;
  protected readonly zones = TEMPERATURE_ZONES;
}
