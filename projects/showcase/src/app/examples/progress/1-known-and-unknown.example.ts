import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatProgress } from '@sima/neat-ui/progress';
import { NeatSlider } from '@sima/neat-ui/slider';

/**
 * Three bars: the first follows the slider under it, the second is complete, and the third has no
 * value, so it moves on its own.
 */
@Component({
  selector: 'app-known-and-unknown',
  imports: [NeatProgress, NeatSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span>Known, from the slider</span>
    <neat-progress label="Upload" [value]="progress()" />
    <neat-slider
      class="slider"
      label="Progress value"
      [min]="0"
      [max]="100"
      [step]="5"
      [(value)]="progress"
    />
    <span>Complete</span>
    <neat-progress label="Import" [value]="100" />
    <span>Unknown</span>
    <neat-progress label="Preparing" [value]="null" />
  `,
  styleUrl: './stack.css',
})
export class KnownAndUnknown {
  protected readonly progress = signal(40);
}
