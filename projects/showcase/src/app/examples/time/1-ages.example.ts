import { ChangeDetectionStrategy, Component } from '@angular/core';
import { neatSecondsAgo } from '@sima/neat-ui';
import { NeatDetails } from '@sima/neat-ui/details';

/** Ages in seconds: one ahead of now, then both sides of each switch of unit. */
const AGES = [-5, 0, 9, 10, 59, 60, 3599, 3600, 86_399, 86_400, 259_200];

/**
 * The words `neatSecondsAgo` says for the ages beside them.
 *
 * -5 s is a time ahead of now, as a clock that stepped back gives. The rest lie on both sides of
 * each switch of unit.
 */
@Component({
  selector: 'app-ages',
  imports: [NeatDetails],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl neatDetails class="ages">
      @for (age of ages; track age) {
        <dt>{{ age }} s</dt>
        <dd>{{ ago(age) }}</dd>
      }
    </dl>
  `,
  styleUrl: './ages.example.css',
})
export class Ages {
  protected readonly ages = AGES;
  protected readonly ago = neatSecondsAgo;
}
