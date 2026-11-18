import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatEasedNumber } from '@sima/neat-ui';

/** The values the number moves through, in turn: steps up and down, small and large. */
const FPS_VALUES = [24, 29.9, 12.4, 18.2];

/**
 * A frame rate that eases to each value instead of jumping. Press Next value for a step, and No
 * value for the dash: the next value after it appears at once, as the first one did.
 *
 * @animated
 * @hide button
 * @play click button
 * @play wait 500
 * @play click button
 * @play wait 500
 * @play click button
 * @play wait 500
 */
@Component({
  selector: 'app-eased-number',
  imports: [NeatButton, NeatEasedNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-eased-number.example.html',
})
export class EasedNumber {
  protected readonly fps = signal<number | null>(FPS_VALUES[0]);
  private index = 0;

  protected next(): void {
    this.index = (this.index + 1) % FPS_VALUES.length;
    this.fps.set(FPS_VALUES[this.index]);
  }
}
