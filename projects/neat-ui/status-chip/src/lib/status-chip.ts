import { ChangeDetectionStrategy, Component, computed, Directive, input } from '@angular/core';
import type { NeatTone } from '@sima/neat-ui';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. Colours are the theme's tokens only; status-chip.spec holds each tone's text to 4.5:1 on
 * its fill in both schemes and both variants.
 */

/**
 * How a chip carries its tone: `solid`, the default, on the tone's status fill; `tinted`, the
 * tone's colour on a light tint of itself, for chips that label parts of a card (a diagram
 * block's) rather than state a status beside a value.
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
 * Each variant gives each tone a fill and a text colour. Solid: the tone's status fill and the
 * text the theme pairs with it. Tinted: the tone's row-tint accent (`--neat-tint-<tone>-accent`,
 * opaque) under the tone's own colour; warning's own colour is a fill, so its text is
 * `--neat-warning-text`, the warning line mixed toward `--foreground` as far as reads on its tint.
 * Neutral is the same in both: muted text on `--neat-chip-neutral`, a grey that shows on the card,
 * the page and a hovered or selected row's `--accent` in both schemes (dark `--muted` is the
 * card's own grey).
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
 * A short status on one of the theme's status fills, the text being the content:
 * `<neat-status-chip tone="success">Live</neat-status-chip>`. For a state in a list's cell or over
 * a panel (Live, Idle, External), or a fact to note beside a value (a codec that cannot be
 * decoded). `highlight` is for a state that is none of the statuses but should stand out (a stream
 * that someone else publishes); a `neat-select-list` row can take the same tone as its chip
 * (`rowTone`). The words are the app's; the colour repeats them and is never the only way a state is
 * told. `variant="tinted"` softens the chip to its tone's colour on a tint (see TONE_CLASSES); a
 * tinted chip belongs on the card or the page, not on a toned list row, whose selected fill is the
 * same tint.
 */
@Component({
  selector: 'neat-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'status-chip', '[class]': 'classes()' },
  template: '<ng-content />',
})
export class NeatStatusChip {
  readonly tone = input<NeatTone>('neutral');
  readonly variant = input<NeatStatusChipVariant>('solid');

  protected readonly classes = computed(
    () => `${CHIP_CLASSES} ${TONE_CLASSES[this.variant()][this.tone()]}`,
  );
}

/**
 * The chip as a button, for a status that opens more about itself, such as a video tile's
 * "Metadata late" that shows why: `<button neatStatusChip tone="warning" type="button">`. It looks
 * like the chip of its tone and stays a native button (focus, Enter and Space, `disabled`), with a
 * pointer and a focus outline. Its name is its text.
 */
@Directive({
  selector: 'button[neatStatusChip]',
  host: { 'data-slot': 'status-chip', '[class]': 'classes()' },
})
export class NeatStatusChipButton {
  readonly tone = input<NeatTone>('neutral');
  readonly variant = input<NeatStatusChipVariant>('solid');

  protected readonly classes = computed(
    () => `${CHIP_CLASSES} ${TONE_CLASSES[this.variant()][this.tone()]} ${BUTTON_CLASSES}`,
  );
}
