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
  template: `
    <div class="fields">
      <label>
        <span>Stream name</span>
        <input neatInput placeholder="Front door" />
      </label>
      <label>
        <span>Go to page</span>
        <input neatInput size="small" type="number" inputmode="numeric" min="1" value="1" />
      </label>
      <label>
        <span>Disabled</span>
        <input neatInput disabled value="Read only" />
      </label>
    </div>
  `,
  styleUrl: './sizes-and-states.example.css',
})
export class SizesAndStates {}
