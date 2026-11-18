import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatInput } from '@sima/neat-ui/input';

/**
 * A text field, a small number field and a disabled one, each named by the label around it. The
 * number field keeps the native `type`, `inputmode` and `min`. The fields sit level at their bottom
 * edge.
 *
 * @gallery
 */
@Component({
  selector: 'app-sizes-and-states',
  imports: [NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-sizes-and-states.example.html',
  styleUrl: './sizes-and-states.example.css',
})
export class SizesAndStates {}
