import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatSlider } from '@sima/neat-ui/slider';

/**
 * A slider described by the note beside it, and a disabled one.
 *
 * @gallery
 */
@Component({
  selector: 'app-described-and-disabled',
  imports: [NeatSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-described-and-disabled.example.html',
  styleUrls: ['./slider-field.css', './described-and-disabled.example.css'],
})
export class DescribedAndDisabled {
  protected readonly gain = signal(30);
}
