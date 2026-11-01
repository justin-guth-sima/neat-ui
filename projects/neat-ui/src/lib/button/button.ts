import { booleanAttribute, computed, Directive, input } from '@angular/core';
import { BrnButton } from '@spartan-ng/brain/button';
import { buttonVariants, type ButtonVariants } from '../ui/button/src';
import { hlm } from '../ui/utils/src';

/**
 * The button's look, by what the action does: `primary` the page's main action, `secondary` a
 * quieter filled one, `outlined` a bordered one, `text` no fill and no border (for actions among
 * others), `danger` a solid red for what stops or discards something, `danger-text` that red as
 * text for a destructive action among text buttons, and `success` a solid green for what starts
 * something.
 */
export type NeatButtonVariant =
  'primary' | 'secondary' | 'outlined' | 'text' | 'danger' | 'danger-text' | 'success';
/** `touch` is a 3rem (48px) target, above the 44px minimum, for kiosk and touch screens. */
export type NeatButtonSize = 'small' | 'medium' | 'large' | 'touch';

type SpartanVariant = NonNullable<ButtonVariants['variant']>;
type SpartanSize = NonNullable<ButtonVariants['size']>;

/**
 * The kit's variants in Spartan's vocabulary, with the hover and focus states the kit sets instead
 * of helm's. Helm's own states break the theme's guarantees, so each override below exists
 * because button.spec failed without it.
 *
 * Focus: helm's 3px ring is the ring colour at 50% (`ring-ring/50`), and danger's is the red at
 * 20% (40% in dark); composited over the page or a card neither reaches the 3:1 a focus indicator
 * needs (WCAG 1.4.11). The kit draws the ring at full strength: `--ring` is held to 3:1 on every
 * surface by the theme, and danger keeps its red, which the theme holds to text contrast.
 *
 * Hover:
 * - primary: `bg-primary/80` lightens the fill under white text to 3.5:1. The theme's
 *   `--primary-hover` is the next scale step away from the background, so text gains contrast.
 * - outlined, text: `bg-muted` is 1.10:1 against white in light, and in dark ghost's `bg-muted/50`
 *   is the card colour itself. `--accent`, the theme's hover and selection fill, is visible on
 *   every surface. Outlined keeps helm's dark hover (`bg-input/50`), which already is.
 * Secondary keeps helm's hover (5% towards the text colour), which keeps its text readable.
 *
 * `danger-text` is the text variant (helm's ghost: no fill, no border) in the danger colour, for a
 * destructive action among text buttons (a Delete beside Rename). Its label is `--destructive`,
 * which the theme holds to text contrast on the page and on a card. It hovers quietly, as the text
 * buttons beside it do: their `--accent` fill, with the label kept red (`hover:text-destructive`
 * replaces ghost's `hover:text-foreground`, a grey label), which button.spec holds to 4.5:1 on that
 * fill. It focuses with danger's red ring. Focus changes neither fill nor text, so the rest and
 * hover contrast hold while focused.
 *
 * `danger` is a solid fill in the status colour (`--destructive` under `--destructive-foreground`),
 * for the action that stops or discards something (Stop recording), as `success` is for the one
 * that starts it; the quiet red is `danger-text`. Helm's destructive is a 10% tint (20% in dark)
 * that hovers to 20% (30%), so the rest classes replace both the tint and its dark twin, and the
 * hover sets both chains too: a stray dark tint would win in dark. It hovers to 90% of its fill,
 * which keeps the foreground readable (the spec holds that in both schemes), and focuses with its
 * red ring, which `--destructive` holds at 3:1 on the page and on a card.
 *
 * `success` is a solid fill in the status colour (`--success` under `--success-foreground`), for a
 * main action that starts something, such as Start recording. Helm has no such variant, so it
 * starts from default's and replaces the colours. It hovers to 90% of its fill: the foreground stays
 * readable on it, which the spec holds in both schemes. It focuses with the ring colour, as primary
 * does, since the ring must read against the page and not against the fill.
 *
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading them.
 */
const TEXT_HOVER = 'hover:bg-accent dark:hover:bg-accent';
const DANGER_FOCUS = 'focus-visible:ring-destructive dark:focus-visible:ring-destructive';

const VARIANTS: Record<
  NeatButtonVariant,
  { spartan: SpartanVariant; rest?: string; hover: string; focus: string }
> = {
  primary: {
    spartan: 'default',
    hover: 'hover:bg-primary-hover',
    focus: 'focus-visible:ring-ring',
  },
  secondary: { spartan: 'secondary', hover: '', focus: 'focus-visible:ring-ring' },
  outlined: { spartan: 'outline', hover: 'hover:bg-accent', focus: 'focus-visible:ring-ring' },
  text: { spartan: 'ghost', hover: TEXT_HOVER, focus: 'focus-visible:ring-ring' },
  danger: {
    spartan: 'destructive',
    rest: 'bg-destructive text-destructive-foreground dark:bg-destructive',
    hover: 'hover:bg-destructive/90 dark:hover:bg-destructive/90',
    focus: DANGER_FOCUS,
  },
  'danger-text': {
    spartan: 'ghost',
    rest: 'text-destructive',
    hover: `${TEXT_HOVER} hover:text-destructive`,
    focus: DANGER_FOCUS,
  },
  success: {
    spartan: 'default',
    rest: 'bg-success text-success-foreground',
    hover: 'hover:bg-success/90',
    focus: 'focus-visible:ring-ring',
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
 * The pressed look, the same for every variant: the page's inverse (`foreground` fill, `background`
 * text). The variants' rest fills are too close to the surface to carry a state at the 3:1 that
 * WCAG 1.4.11 asks (`accent` is 1.1:1 on white), and the primary variant's is solid already. The
 * spec checks, from the emitted tokens, in both schemes and over background and card:
 * - the text is at least 4.5:1 on the fill;
 * - the fill is at least 3:1 against the surface;
 * - the fill is at least 3:1 against the variant's resting fill, except primary in dark (2.78:1;
 *   in light it reaches 3.9:1), success (2.86:1 in light, 2.0:1 in dark) and danger (2.87:1 in
 *   light, 2.48:1 in dark), where no fill is 3:1 from both their solid fill and the surface.
 * Hover fills are not compared: the pressed fill against a hovered primary is lower (2.07:1 in
 * dark).
 *
 * It sets the colour in all four chains the variants use (rest, hover, dark, dark hover) so that
 * the merge replaces whatever the variant's classes set there. Hover does not change a pressed
 * button: a lighter or darker fill would fall back towards the rest look.
 */
const PRESSED =
  'bg-foreground text-background hover:bg-foreground hover:text-background dark:bg-foreground dark:text-background dark:hover:bg-foreground dark:hover:text-background';

/**
 * The look of a button that is `aria-disabled` rather than `disabled`: dimmed as helm dims a
 * disabled one (`data-disabled:opacity-50`), with a not-allowed cursor. Helm's
 * `data-disabled:pointer-events-none` is left out on purpose: the pointer still reaches the
 * button, so a tooltip on it (why it waits) opens on hover, and its click reaches the handler,
 * which ignores presses while the button waits. Such a button keeps the focus, which a `disabled`
 * one loses: a main action that changes its label while it waits, or a dialog's close button
 * while the dialog is busy.
 */
const HELD = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

/**
 * A button or link styled as a kit button. Content is the label and/or a `neat-icon`; an
 * icon-only button needs an `aria-label` (and usually a `neatTooltip` with the same text).
 *
 * Built from Spartan's brain primitive and helm's class map rather than on helm's directive:
 * every host directive of a public directive becomes public API, and helm stays internal.
 * The classes go through Angular's `[class]` binding, not helm's `classes()`, which rewrites
 * `className` and can drop a `[class.x]` binding that changes in the same render.
 *
 * A toggle button binds `pressed`: it sets `aria-pressed` and the pressed look. Leave it undefined
 * on a button that is not a toggle, since `aria-pressed="false"` would announce one.
 *
 * `[attr.aria-disabled]="true"` dims the button with a not-allowed cursor while it stays focusable
 * and its tooltip still opens on hover, for a button that waits and must not drop the focus. The
 * kit only styles it: a click, Enter and Space all still fire `click`, so the handler ignores
 * presses while it waits.
 *
 * @input disabled Turns the button off: dimmed, out of the Tab order and not clickable (a link
 * gets no `disabled` attribute but the same look and `tabindex="-1"`). It loses the focus; use
 * `aria-disabled` for a button that waits.
 */
@Directive({
  selector: 'button[neatButton], a[neatButton]',
  hostDirectives: [{ directive: BrnButton, inputs: ['disabled'] }],
  host: {
    'data-slot': 'button',
    '[class]': 'classes()',
    '[attr.aria-pressed]': 'pressed()',
  },
})
export class NeatButton {
  /** The look of the button, by the kind of action it starts; `primary` is the main one. */
  readonly variant = input<NeatButtonVariant>('primary');
  /** The button's height: `small`, `medium`, `large` or `touch` (3rem), for touch screens. */
  readonly size = input<NeatButtonSize>('medium');
  /** Square (or, with `rounded`, circular) and sized for a single icon. */
  readonly iconOnly = input(false, { transform: booleanAttribute });
  /** Fully rounded ends: a pill, or a circle when `iconOnly`. */
  readonly rounded = input(false, { transform: booleanAttribute });
  /**
   * A toggle's state: `aria-pressed` and the pressed look. Undefined for a button that is not a
   * toggle. Only for `button[neatButton]`: `aria-pressed` is not valid on a link. The primary,
   * success and danger variants are solid fills already, so their pressed look is the least
   * distinct (primary 2.78:1 against its resting fill in dark; success 2.86:1 in light and 2.0:1
   * in dark; danger 2.87:1 in light and 2.48:1 in dark); put toggles on the other variants.
   */
  readonly pressed = input<boolean | undefined>(undefined);

  protected readonly classes = computed(() => {
    const variant = VARIANTS[this.variant()];
    const size = SIZES[this.size()];
    const iconOnly = this.iconOnly();
    return hlm(
      buttonVariants({
        variant: variant.spartan,
        size: iconOnly ? size.spartanIconOnly : size.spartan,
      }),
      variant.rest,
      variant.hover,
      variant.focus,
      HELD,
      iconOnly ? size.extraIconOnly : size.extra,
      this.rounded() && 'rounded-full',
      this.pressed() && PRESSED,
    );
  });
}
