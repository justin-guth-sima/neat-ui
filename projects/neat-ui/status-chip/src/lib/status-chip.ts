import { ChangeDetectionStrategy, Component, computed, Directive, input } from '@angular/core';
import { type NeatTone, ɵbadgeButtonClasses, ɵbadgeClasses } from '@sima/neat-ui';

/*
 * The status chip became the badge (`@sima/neat-ui/badge`) in 0.44. These are its old names,
 * kept for one release. They keep 0.43's colors and default: `solid` stays their default, and
 * `tinted` is the badge's `soft`, the colors `tinted` had. Their shape is the badge's: a 20 px
 * pill, and on the button helm's focus ring at full `--ring`.
 */

/** The chip's variants in the badge's words. */
const AS_BADGE = { solid: 'solid', tinted: 'soft' } as const;

/**
 * How a chip carries its tone: `solid` (the default) or `tinted`.
 *
 * The colors are 0.43's; the shape is the badge's.
 *
 * @deprecated Use `NeatBadgeVariant` from `@sima/neat-ui/badge`, where `tinted` is `soft`; this
 * name goes in a later release.
 */
export type NeatStatusChipVariant = 'solid' | 'tinted';

/**
 * The old name of `neat-badge`, kept so apps that use it keep working. It keeps 0.43's colors and
 * its default, `solid`, where the badge defaults to `soft`; its shape is the badge's, a 20 px pill.
 *
 * @deprecated Use `NeatBadge` (`neat-badge`) from `@sima/neat-ui/badge`; this name goes in a later
 * release.
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

  protected readonly classes = computed(() => ɵbadgeClasses(this.tone(), AS_BADGE[this.variant()]));
}

/**
 * The old name of `button[neatBadge]`, kept so apps that use it keep working. It keeps 0.43's
 * colors and its default, `solid`, where the badge defaults to `soft`; its shape is the badge's, a
 * 20 px pill with helm's focus ring at full `--ring`.
 *
 * @deprecated Use `NeatBadgeButton` (`button[neatBadge]`) from `@sima/neat-ui/badge`; this name
 * goes in a later release.
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

  protected readonly classes = computed(() =>
    ɵbadgeButtonClasses(this.tone(), AS_BADGE[this.variant()]),
  );
}
