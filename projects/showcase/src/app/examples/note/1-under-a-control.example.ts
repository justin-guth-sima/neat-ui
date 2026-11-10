import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatInlineButton, NeatNote } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';

/**
 * A note under the input it describes (`aria-describedby`), with an inline button in its text.
 *
 * @gallery
 */
@Component({
  selector: 'app-under-a-control',
  imports: [NeatInlineButton, NeatInput, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="showcase-row">
      Delay
      <input neatInput type="text" value="600" aria-describedby="delay-note" />
    </label>
    <p neatNote id="delay-note">
      Applies to every channel that has no value of its own.
      <button neatInlineButton type="button">Show channels</button>
    </p>
  `,
  styleUrl: './under-a-control.example.css',
})
export class UnderAControl {}
