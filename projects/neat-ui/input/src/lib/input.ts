import { computed, Directive, input } from '@angular/core';
import { BrnInput } from '@spartan-ng/brain/input';
import {
  ɵINPUT_CLASSES as INPUT_CLASSES,
  ɵINPUT_HELM_CLASSES as HELM_CLASSES,
} from '@sima/neat-ui';

/** `medium` matches the kit's medium button (2.25rem), `small` its small one (2rem). */
export type NeatInputSize = 'small' | 'medium';

/**
 * Helm's input classes, re-exported for input.spec's drift check; the primary keeps them with the
 * field's look, which the page nav shares for its filter.
 */
export const INPUT_HELM_CLASSES = HELM_CLASSES;

/**
 * A text or number field: `<input neatInput type="number" inputmode="numeric" min="1">`. Every
 * native attribute (type, inputmode, min, max, placeholder, id, disabled) keeps its meaning; the
 * kit only styles the field. Name it with a `<label for>` or an `aria-label`.
 *
 * `size` is the kit's height, not the native character width: bind it (`[size]="'small'"`) or set
 * it as an attribute, which the browser ignores as a width since it is not a number.
 *
 * Brain's input is the host directive. Its `id` input is exposed so that an `id` the app sets
 * stays on the element (brain would otherwise replace it with its own) and a label can point at
 * it.
 *
 * @input id The field's `id`, for a `<label for>` to point at; without one the field gets an id
 * of its own.
 */
@Directive({
  selector: 'input[neatInput]',
  hostDirectives: [{ directive: BrnInput, inputs: ['id'] }],
  host: { 'data-slot': 'input', '[class]': 'classes()' },
})
export class NeatInput {
  /** The field's height, the kit's `medium` (2.25rem) or `small` (2rem); not a character width. */
  readonly size = input<NeatInputSize>('medium');

  protected readonly classes = computed(() => INPUT_CLASSES[this.size()]);
}
