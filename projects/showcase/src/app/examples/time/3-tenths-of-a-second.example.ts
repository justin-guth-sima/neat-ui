import { ChangeDetectionStrategy, Component } from '@angular/core';
import { neatDuration } from '@sima/neat-ui';
import { NeatDetails } from '@sima/neat-ui/details';

/** Lengths in seconds, as a run's might be: under a second, under a minute, and past one. */
const LENGTHS = [0.85, 34.38, 59.99, 60, 307.5];

/**
 * A run's length read closely: with `{ tenths: true }`, `neatDuration` says tenths of a second
 * under a minute, cut as a clock does, and a minute and more as without them.
 */
@Component({
  selector: 'app-tenths-of-a-second',
  imports: [NeatDetails],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-tenths-of-a-second.example.html',
  styleUrl: './durations.example.css',
})
export class TenthsOfASecond {
  protected readonly lengths = LENGTHS;
  protected readonly duration = (seconds: number) => neatDuration(seconds, { tenths: true });
}
