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
  template: `
    <neat-progress
      heading="Encoding clip.mp4"
      detail="0:41 / 1:37 · h264_v4l2m2m, at 30 fps, a very long detail that cuts at the end"
      [value]="progress()"
    />
    <neat-slider
      class="slider"
      label="Encoded share"
      [min]="0"
      [max]="100"
      [step]="5"
      [(value)]="progress"
    />
    <neat-progress heading="Preparing" detail="Probing the file" [value]="null" />
  `,
  styleUrl: './stack.css',
})
export class TitledReadout {
  protected readonly progress = signal(40);
}
