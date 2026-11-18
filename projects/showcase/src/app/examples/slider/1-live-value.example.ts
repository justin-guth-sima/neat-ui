import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatSlider } from '@sima/neat-ui/slider';

/** An opacity slider with its value beside it: drag, and the number follows every step. */
@Component({
  selector: 'app-live-value',
  imports: [NeatSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-live-value.example.html',
  styleUrl: './slider-field.css',
})
export class LiveValue {
  protected readonly opacity = signal(60);
}
