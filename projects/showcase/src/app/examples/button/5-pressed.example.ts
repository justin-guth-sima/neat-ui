import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, type NeatButtonVariant, NeatIcon, NeatTooltip } from '@sima/neat-ui';
import { VARIANTS } from './variants';

/**
 * `[pressed]` on a toggle, on the page and on a card: it sets `aria-pressed` and inverts the fill,
 * so the state does not rest on colour alone. Click each one. Primary and success are solid fills
 * already, so their pressed look is the least distinct; toggles belong on the other variants. The
 * last button leaves `pressed` unset, as a button that is not a toggle does, and is an icon-only
 * `close` button with a tooltip.
 */
@Component({
  selector: 'app-pressed',
  imports: [NeatButton, NeatIcon, NeatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (surface of surfaces; track surface) {
      <div class="showcase-row" [class.card]="surface === 'card'">
        @for (variant of variants; track variant) {
          <button
            neatButton
            type="button"
            [variant]="variant"
            [pressed]="pressedVariants().has(variant)"
            (click)="toggle(variant)"
          >
            {{ variant }}
          </button>
        }
        <button
          neatButton
          type="button"
          variant="outlined"
          iconOnly
          aria-label="Close"
          neatTooltip="Close"
        >
          <neat-icon name="close" />
        </button>
      </div>
    }
  `,
  styleUrls: ['./card.css', './pressed.example.css'],
})
export class Pressed {
  protected readonly variants = VARIANTS;
  /** The surfaces a button sits on, as the contrast tests have it: the page and a card. */
  protected readonly surfaces = ['page', 'card'] as const;
  protected readonly pressedVariants = signal<ReadonlySet<NeatButtonVariant>>(
    new Set(['secondary', 'outlined']),
  );

  protected toggle(variant: NeatButtonVariant): void {
    this.pressedVariants.update((pressed) => {
      const next = new Set(pressed);
      if (!next.delete(variant)) next.add(variant);
      return next;
    });
  }
}
