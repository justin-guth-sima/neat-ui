import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatSwitch } from '@sima/neat-ui/switch';

/**
 * Two switches with a label, and a third without content, which takes an `aria-label`. The third
 * shares its value with the first: try toggling either. Last come two disabled ones, off and on.
 *
 * @gallery
 */
@Component({
  selector: 'app-on-and-off',
  imports: [NeatSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-on-and-off.example.html',
  styleUrl: './on-and-off.example.css',
})
export class OnAndOff {
  protected readonly bars = signal(true);
  protected readonly hideEmpty = signal(false);
}
