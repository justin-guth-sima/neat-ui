import { ChangeDetectionStrategy, Component, computed, Directive, input } from '@angular/core';

/** What a chip's fill says: nothing in particular, it went well, take note, it failed, for info. */
export type NeatStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. Colours are the theme's tokens only; status-chip.spec holds each tone's text to 4.5:1 on
 * its fill in both schemes.
 */

/**
 * A small label in the small text size that truncates rather than widen the column or bar it
 * sits in. The line height is set apart from the size (`text-xs` would bring its own), so the chip
 * is as tall in a list's cell as in a video tile's bar.
 */
const CHIP_CLASSES =
  'inline-block max-w-full truncate rounded-(--radius) px-(--neat-space-2) align-middle text-(length:--neat-text-xs) leading-normal font-medium';

/** Each tone is a fill and the text colour the theme pairs with it. */
const TONE_CLASSES: Record<NeatStatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  danger: 'bg-destructive text-destructive-foreground',
  info: 'bg-info text-info-foreground',
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
 * decoded). The words are the app's; the colour repeats them and is never the only way a state is
 * told.
 */
@Component({
  selector: 'neat-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'status-chip', '[class]': 'classes()' },
  template: '<ng-content />',
})
export class NeatStatusChip {
  readonly tone = input<NeatStatusTone>('neutral');

  protected readonly classes = computed(() => `${CHIP_CLASSES} ${TONE_CLASSES[this.tone()]}`);
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
  readonly tone = input<NeatStatusTone>('neutral');

  protected readonly classes = computed(
    () => `${CHIP_CLASSES} ${TONE_CLASSES[this.tone()]} ${BUTTON_CLASSES}`,
  );
}
