import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, type NeatButtonSize, NeatIcon } from '@sima/neat-ui';
import { VARIANTS } from './variants';

const SIZES: NeatButtonSize[] = ['small', 'medium', 'large', 'touch'];

/**
 * Each of the seven variants in the four sizes. Then the four sizes again as icon-only buttons,
 * which need an `aria-label`, and `rounded` as a pill and as a circle.
 *
 * @gallery
 */
@Component({
  selector: 'app-variants',
  imports: [NeatButton, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-variants.example.html',
  styleUrls: ['./stack.css', './variants.example.css'],
})
export class Variants {
  protected readonly variants = VARIANTS;
  protected readonly sizes = SIZES;
}
