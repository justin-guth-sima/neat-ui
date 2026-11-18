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
  templateUrl: './1-known-and-unknown.example.html',
  styleUrl: './stack.css',
})
export class KnownAndUnknown {
  protected readonly progress = signal(40);
}
