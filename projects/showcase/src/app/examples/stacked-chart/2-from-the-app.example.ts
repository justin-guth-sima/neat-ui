import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { type NeatSamplePick, NeatStackedChart } from '@sima/neat-ui/charts';
import { RAILS, TIMES, watts } from './data';

/** A moment as the card says it: the time of day, in UTC like the demo's data. */
const clock = (time: number) => new Date(time).toISOString().slice(11, 19);

/**
 * The app reads the chart and sets it.
 *
 * - `hovered` is the moment the readout is on: the pointer's or the keys' sample, or one the app
 *   sets, shown at the nearest sample.
 * - `activated` reports a click or Enter, with the sample's time and each band's value.
 *
 * The card shows both. Its buttons set the moment from outside.
 *
 * @unpictured
 */
@Component({
  selector: 'app-stacked-from-the-app',
  imports: [NeatButton, NeatStackedChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-from-the-app.example.html',
  styleUrls: ['./power-rails.example.css', './report.example.css'],
})
export class StackedFromTheApp {
  protected readonly rails = RAILS;
  protected readonly times = TIMES;
  protected readonly watts = watts;
  protected readonly moment = signal<number | null>(null);
  protected readonly picked = signal<NeatSamplePick | null>(null);

  protected readonly momentText = computed(() => {
    const time = this.moment();
    return time === null ? 'None' : clock(time);
  });

  protected readonly pickedText = computed(() => {
    const pick = this.picked();
    if (!pick) return 'None yet';
    const total = pick.values.reduce((sum, { value }) => sum + (value ?? 0), 0);
    return `${pick.time === null ? 'A sample' : clock(pick.time)}: ${watts(total)} in all`;
  });
}
