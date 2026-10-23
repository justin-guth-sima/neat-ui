import { computed, Directive, input } from '@angular/core';
import { BrnInput } from '@spartan-ng/brain/input';
import { ɵhlm as hlm } from '@sima/neat-ui';

/** `medium` matches the kit's medium button (2.25rem), `small` its small one (2rem). */
export type NeatInputSize = 'small' | 'medium';

/**
 * Helm's input classes (`lib/ui/input/src/lib/hlm-input.ts`), copied because helm keeps them
 * inline. input.spec checks that the string still appears in the vendored helm, so a helm update
 * that changes it fails until this is reviewed.
 */
export const INPUT_HELM_CLASSES =
  'dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 data-[matches-spartan-invalid=true]:ring-destructive/20 dark:data-[matches-spartan-invalid=true]:ring-destructive/40 data-[matches-spartan-invalid=true]:border-destructive dark:data-[matches-spartan-invalid=true]:border-destructive/50 h-9 rounded-md border bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] file:h-7 file:text-sm file:font-medium focus-visible:ring-3 data-[matches-spartan-invalid=true]:ring-3 md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Where the kit departs from helm; each override exists because input.spec failed without it.
 * - Focus ring: helm's `ring-ring/50` is about 1.85:1 on white, where a focus indicator needs
 *   3:1; the kit draws full `--ring`, which the theme holds to it.
 * - Dark fill: helm tints the field with `--input` at 30%, which takes the placeholder to 4.2:1
 *   on a card. The field stays transparent as in light; its border marks it at 3:1 or more.
 */
const OVERRIDES = 'focus-visible:ring-ring dark:bg-transparent';

/** The kit's sizes over helm's `h-9`; class strings stay literals for Tailwind to find. */
const SIZES: Record<NeatInputSize, string> = {
  small: 'h-8',
  medium: '',
};

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
 */
@Directive({
  selector: 'input[neatInput]',
  hostDirectives: [{ directive: BrnInput, inputs: ['id'] }],
  host: { 'data-slot': 'input', '[class]': 'classes()' },
})
export class NeatInput {
  readonly size = input<NeatInputSize>('medium');

  protected readonly classes = computed(() =>
    hlm(INPUT_HELM_CLASSES, OVERRIDES, SIZES[this.size()]),
  );
}
