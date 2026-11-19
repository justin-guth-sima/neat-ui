import { ChangeDetectionStrategy, Component } from '@angular/core';
import { neatDuration } from '@sima/neat-ui';
import { NeatDetails } from '@sima/neat-ui/details';

/** Lengths in seconds: both sides of each switch of unit, a fraction, and no value. */
const LENGTHS = [0, 59.9, 60, 307, 3599, 3600, 7559, 86_399, 86_400, 273_540, -1, null];

/**
 * The words `neatDuration` says for the lengths of time beside them.
 *
 * 59.9 s is cut to 59 s, as a clock shows it. A negative length and no value at all are a dash.
 */
@Component({
  selector: 'app-durations',
  imports: [NeatDetails],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-durations.example.html',
  styleUrl: './durations.example.css',
})
export class Durations {
  protected readonly lengths = LENGTHS;
  protected readonly duration = neatDuration;
}
