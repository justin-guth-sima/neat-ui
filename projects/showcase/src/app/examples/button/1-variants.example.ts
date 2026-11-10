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
  template: `
    @for (variant of variants; track variant) {
      <section>
        <h4>{{ variant }}</h4>
        <div class="showcase-row">
          @for (size of sizes; track size) {
            <button neatButton type="button" [variant]="variant" [size]="size">{{ size }}</button>
          }
          @for (size of sizes; track size) {
            <button
              neatButton
              type="button"
              [variant]="variant"
              [size]="size"
              iconOnly
              [attr.aria-label]="'Stream, ' + size"
            >
              <neat-icon name="streaming" />
            </button>
          }
          <button neatButton type="button" [variant]="variant" rounded>rounded</button>
          <button
            neatButton
            type="button"
            [variant]="variant"
            rounded
            iconOnly
            aria-label="Stream, rounded"
          >
            <neat-icon name="streaming" />
          </button>
        </div>
      </section>
    }
  `,
  styleUrls: ['./stack.css', './variants.example.css'],
})
export class Variants {
  protected readonly variants = VARIANTS;
  protected readonly sizes = SIZES;
}
