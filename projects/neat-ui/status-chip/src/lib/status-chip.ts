import { ChangeDetectionStrategy, Component, computed, Directive, input } from '@angular/core';
import type { NeatTone } from '@sima/neat-ui';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. Colors are the theme's tokens only; status-chip.spec holds each tone's text to 4.5:1 on
 * its fill in both schemes and both variants.
 */

/**
 * How a chip carries its tone: `solid` (the default) or `tinted`.
 *
 * `solid` is on the tone's status fill. `tinted` is the tone's color on a light tint of itself. Use
 * it for chips that label parts of a card, such as a diagram block's, rather than state a status
 * beside a value.
 */
export type NeatStatusChipVariant = 'solid' | 'tinted';

/**
 * A small label in the small text size that truncates rather than widen the column or bar it
 * sits in. The line height is set apart from the size (`text-xs` would bring its own), so the chip
 * is as tall in a list's cell as in a video tile's bar.
 */
const CHIP_CLASSES =
  'inline-block max-w-full truncate rounded-(--radius) px-(--neat-space-2) align-middle text-(length:--neat-text-xs) leading-normal font-medium';

/**
 * Each variant gives each tone a fill and a text color. Solid: the tone's status fill and the
 * text the theme pairs with it. Tinted: the tone's row-tint accent (`--neat-tint-<tone>-accent`,
 * opaque) under the tone's own color; warning's own color is a fill, so its text is
 * `--neat-warning-text`, the warning line mixed toward `--foreground` as far as reads on its tint.
 * Neutral is the same in both: muted text on `--neat-chip-neutral`, a gray that shows on the card,
 * the page and a hovered or selected row's `--accent` in both schemes (dark `--muted` is the
 * card's own gray).
 */
const TONE_CLASSES: Record<NeatStatusChipVariant, Record<NeatTone, string>> = {
  solid: {
    neutral: 'bg-neat-chip-neutral text-muted-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
    danger: 'bg-destructive text-destructive-foreground',
    info: 'bg-info text-info-foreground',
    highlight: 'bg-highlight text-highlight-foreground',
  },
  tinted: {
    neutral: 'bg-neat-chip-neutral text-muted-foreground',
    success: 'bg-neat-tint-success-accent text-success',
    warning: 'bg-neat-tint-warning-accent text-neat-warning-text',
    danger: 'bg-neat-tint-danger-accent text-destructive',
    info: 'bg-neat-tint-info-accent text-info',
    highlight: 'bg-neat-tint-highlight-accent text-highlight',
  },
};

/**
 * The button's additions:
 * - the pointer, and the focus outline the kit draws at full `--ring` (held to 3:1 by the theme),
 *   set off the fill so it shows on every tone;
 * - no shrinking: in a row such as a video tile's bar, beside a status that takes the rest, the
 *   chip keeps its text whole;
 * - the disabled look of the kit's buttons, dimmed with a not-allowed cursor.
 */
const BUTTON_CLASSES =
  'shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * A short status on a status color, such as Live or Idle.
 *
 * ```html
 * <neat-status-chip tone="success">Live</neat-status-chip>
 * ```
 *
 * Use it for a state in a list's cell or over a panel: Live, Idle, External. Or use it for a fact
 * beside a value, such as a codec that cannot be decoded. The words are the app's. The color
 * repeats them and is never the only way a state is told.
 *
 * `highlight` is for a state that is none of the statuses but should stand out, such as a stream
 * that someone else publishes. A `neat-select-list` row can take the same tone as its chip, with
 * `rowTone`.
 *
 * A chip truncates rather than widen the cell or bar that holds it.
 *
 * `variant="tinted"` softens the chip to its tone's color on a tint. A tinted chip belongs on a
 * card or the page, not on a toned list row, whose selected fill is the same tint.
 */
@Component({
  selector: 'neat-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'status-chip', '[class]': 'classes()' },
  template: '<ng-content />',
})
export class NeatStatusChip {
  /** The status the chip states, which sets its colors; `neutral` for a plain label. */
  readonly tone = input<NeatTone>('neutral');
  /** `solid` (the default) fills the chip with the tone; `tinted` shows it on a light tint. */
  readonly variant = input<NeatStatusChipVariant>('solid');

  protected readonly classes = computed(
    () => `${CHIP_CLASSES} ${TONE_CLASSES[this.variant()][this.tone()]}`,
  );
}

/**
 * The chip as a button, for a status that opens more about itself.
 *
 * ```html
 * <button neatStatusChip tone="warning" type="button" (click)="showWhy()">Metadata late</button>
 * ```
 *
 * A video tile's "Metadata late", which shows why when pressed, is one. It looks like the chip of
 * its tone, with a pointer and a focus outline. It stays a native button, with its focus, Enter and
 * Space, and `disabled`. Its name is its text.
 */
@Directive({
  selector: 'button[neatStatusChip]',
  host: { 'data-slot': 'status-chip', '[class]': 'classes()' },
})
export class NeatStatusChipButton {
  /** The status the chip states, which sets its colors; `neutral` for a plain label. */
  readonly tone = input<NeatTone>('neutral');
  /** `solid` (the default) fills the chip with the tone; `tinted` shows it on a light tint. */
  readonly variant = input<NeatStatusChipVariant>('solid');

  protected readonly classes = computed(
    () => `${CHIP_CLASSES} ${TONE_CLASSES[this.variant()][this.tone()]} ${BUTTON_CLASSES}`,
  );
}
