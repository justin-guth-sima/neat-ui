import { booleanAttribute, computed, Directive, input } from '@angular/core';
import { BrnButton } from '@spartan-ng/brain/button';
import { buttonVariants, type ButtonVariants } from '../ui/button/src';
import { hlm } from '../ui/utils/src';

export type NeatButtonVariant = 'primary' | 'secondary' | 'outlined' | 'text' | 'danger';
/** `touch` is a 3rem (48px) target, above the 44px minimum, for kiosk and touch screens. */
export type NeatButtonSize = 'small' | 'medium' | 'large' | 'touch';

type SpartanVariant = NonNullable<ButtonVariants['variant']>;
type SpartanSize = NonNullable<ButtonVariants['size']>;

/**
 * The kit's variants in Spartan's vocabulary, with the hover states the kit sets instead of helm's.
 * Helm's hovers break the theme's guarantees, so each override below exists because button.spec
 * failed without it:
 * - primary: `bg-primary/80` lightens the fill under white text to 3.5:1. The theme's
 *   `--primary-hover` is the next scale step away from the background, so text gains contrast.
 * - outlined, text: `bg-muted` is 1.10:1 against white in light, and in dark ghost's `bg-muted/50`
 *   is the card colour itself. `--accent`, the theme's hover and selection fill, is visible on
 *   every surface. Outlined keeps helm's dark hover (`bg-input/50`), which already is.
 * - danger: a deeper tint (`/30` in dark) drops the red text to 4.0:1 on a card; the theme only
 *   guarantees status text on its resting tint. On hover it takes the solid fill and its
 *   foreground, a pair the theme guarantees, in both schemes alike.
 * Secondary keeps helm's hover (5% towards the text colour), which keeps its text readable.
 *
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading them.
 */
const VARIANTS: Record<NeatButtonVariant, { spartan: SpartanVariant; hover: string }> = {
  primary: { spartan: 'default', hover: 'hover:bg-primary-hover' },
  secondary: { spartan: 'secondary', hover: '' },
  outlined: { spartan: 'outline', hover: 'hover:bg-accent' },
  text: { spartan: 'ghost', hover: 'hover:bg-accent dark:hover:bg-accent' },
  danger: {
    spartan: 'destructive',
    hover: 'hover:bg-destructive hover:text-destructive-foreground dark:hover:bg-destructive',
  },
};

/** The kit's sizes in Spartan's vocabulary, for buttons with a label and for icon-only ones. */
const SIZES: Record<
  NeatButtonSize,
  { spartan: SpartanSize; spartanIconOnly: SpartanSize; extra?: string; extraIconOnly?: string }
> = {
  small: { spartan: 'sm', spartanIconOnly: 'icon-sm' },
  medium: { spartan: 'default', spartanIconOnly: 'icon' },
  large: { spartan: 'lg', spartanIconOnly: 'icon-lg' },
  // Spartan stops at 2.5rem. These replace its height (tailwind-merge drops the conflicting class).
  touch: {
    spartan: 'lg',
    spartanIconOnly: 'icon-lg',
    extra: 'h-auto min-h-12 min-w-12',
    extraIconOnly: 'size-12',
  },
};

/**
 * A button or link styled as a kit button. Content is the label and/or a `neat-icon`; an
 * icon-only button needs an `aria-label` (and usually a `neatTooltip` with the same text).
 *
 * Built from Spartan's brain primitive and helm's class map rather than on helm's directive:
 * every host directive of a public directive becomes public API, and helm stays internal.
 * The classes go through Angular's `[class]` binding, not helm's `classes()`, which rewrites
 * `className` and can drop a `[class.x]` binding that changes in the same render.
 */
@Directive({
  selector: 'button[neatButton], a[neatButton]',
  hostDirectives: [{ directive: BrnButton, inputs: ['disabled'] }],
  host: { 'data-slot': 'button', '[class]': 'classes()' },
})
export class NeatButton {
  readonly variant = input<NeatButtonVariant>('primary');
  readonly size = input<NeatButtonSize>('medium');
  /** Square (or, with `rounded`, circular) and sized for a single icon. */
  readonly iconOnly = input(false, { transform: booleanAttribute });
  /** Fully rounded ends: a pill, or a circle when `iconOnly`. */
  readonly rounded = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() => {
    const variant = VARIANTS[this.variant()];
    const size = SIZES[this.size()];
    const iconOnly = this.iconOnly();
    return hlm(
      buttonVariants({
        variant: variant.spartan,
        size: iconOnly ? size.spartanIconOnly : size.spartan,
      }),
      variant.hover,
      iconOnly ? size.extraIconOnly : size.extra,
      this.rounded() && 'rounded-full',
    );
  });
}
