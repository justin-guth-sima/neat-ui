import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { VARIANTS } from './variants';

/**
 * Every variant on the card surface, which differs from the page's background in dark mode. Hover
 * each one: the fill must stay visible.
 */
@Component({
  selector: 'app-on-a-card',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card showcase-row">
      @for (variant of variants; track variant) {
        <button neatButton type="button" [variant]="variant">{{ variant }}</button>
      }
    </div>
  `,
  styleUrl: './card.css',
})
export class OnACard {
  protected readonly variants = VARIANTS;
}
