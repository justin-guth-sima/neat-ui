import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatProgress } from '@sima/neat-ui/progress';
import { NeatSlider } from '@sima/neat-ui/slider';

/**
 * Two titled readouts. The first follows the slider. Its detail is longer than the line, so it is
 * cut at the end, and hovering it shows the whole text. The second has no value, so it has no
 * percent.
 *
 * @gallery
 * @animated
 * @hide .slider
 * @play click at 30%,50% .slider [brnSliderTrack]
 * @play wait 500
 * @play click at 70%,50% .slider [brnSliderTrack]
 * @play wait 500
 * @play click at 100%,50% .slider [brnSliderTrack]
 * @play wait 500
 */
@Component({
  selector: 'app-titled-readout',
  imports: [NeatProgress, NeatSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-titled-readout.example.html',
  styleUrl: './stack.css',
})
export class TitledReadout {
  protected readonly progress = signal(40);
}
