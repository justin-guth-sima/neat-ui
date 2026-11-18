import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, type NeatButtonVariant, NeatIcon, NeatTooltip } from '@sima/neat-ui';
import { VARIANTS } from './variants';

/**
 * `[pressed]` on a toggle, on the page and on a card: click each one. Primary and success are
 * solid fills, so look at their pressed state first. The last button leaves `pressed` unset, as a
 * button that is not a toggle does: an icon-only `close` button with a tooltip.
 */
@Component({
  selector: 'app-pressed',
  imports: [NeatButton, NeatIcon, NeatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './5-pressed.example.html',
  styleUrls: ['./card.css', './stack.css'],
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
