import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { neatEased } from './eased';
import type { NeatEasing } from './easing';

/**
 * A figure that eases to each new value instead of jumping.
 *
 * ```html
 * <neat-eased-number [value]="fps()" [digits]="1" /> fps
 * ```
 *
 * It moves as `neatEased` does. Its first value shows at once, and "–" stands in while there is
 * none. Its digits are tabular, so a moving value keeps its width.
 *
 * It is the number only: the unit and the words around it are the app's.
 */
@Component({
  selector: 'neat-eased-number',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tabular-nums' },
  template: `{{ text() }}`,
})
export class NeatEasedNumber {
  /** The value to show; null or undefined while there is none. */
  readonly value = input<number | null | undefined>();
  /** Digits after the decimal point. */
  readonly digits = input(0);

  /** The curve it moves by; a catalog name, or a function where none fits. */
  readonly easing = input<NeatEasing>('ease-in-out');

  private readonly shown = neatEased(this.value, { easing: this.easing });
  protected readonly text = computed(() => {
    const value = this.shown();
    return value === null || value === undefined ? '–' : value.toFixed(this.digits());
  });
}
