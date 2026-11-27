import { ChangeDetectionStrategy, Component, computed, Directive, input } from '@angular/core';
import { type NeatTone, ɵbadgeButtonClasses, ɵbadgeClasses } from '@sima/neat-ui';

/**
 * How a badge carries its tone: `soft` (the default) or `solid`.
 *
 * `soft` is the tone's color on a light tint of itself, quiet enough for several badges side by
 * side, such as a diagram block's. `solid` fills the badge with the tone's status color, for the
 * rare badge that must stand out, such as a notice over video. Neutral is the same gray in both.
 */
export type NeatBadgeVariant = 'soft' | 'solid';

/**
 * A short status or fact in a small pill, such as Live, Idle or HW.
 *
 * ```html
 * <neat-badge tone="success">Live</neat-badge>
 * ```
 *
 * Use it for a state in a list's cell or over a panel: Live, Idle, External. Or use it for a fact
 * beside a value, such as a codec that cannot be decoded, or where a part runs. The words are the
 * app's. The color repeats them and is never the only way a state is told.
 *
 * `highlight` is for a state that is none of the statuses but should stand out, such as a stream
 * that someone else publishes. A `neat-select-list` row can take the same tone as its badge, with
 * `rowTone`.
 *
 * It is Spartan's badge in the kit's tones. A badge is never wider than the cell or bar that holds
 * it, and cuts its text at that width.
 */
@Component({
  selector: 'neat-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'badge', '[class]': 'classes()' },
  template: '<ng-content />',
})
export class NeatBadge {
  /** The status the badge states, which sets its colors; `neutral` for a plain label. */
  readonly tone = input<NeatTone>('neutral');
  /** `soft` (the default) shows the tone on a light tint; `solid` fills the badge with it. */
  readonly variant = input<NeatBadgeVariant>('soft');

  protected readonly classes = computed(() => ɵbadgeClasses(this.tone(), this.variant()));
}

/**
 * The badge as a button, for a status that opens more about itself.
 *
 * ```html
 * <button neatBadge tone="warning" type="button" (click)="showWhy()">Metadata late</button>
 * ```
 *
 * A video tile's "Metadata late", which shows why when pressed, is one. It looks like the badge of
 * its tone, with a pointer and a focus ring. It stays a native button, with its focus, Enter and
 * Space, and `disabled`. Its name is its text.
 */
@Directive({
  selector: 'button[neatBadge]',
  host: { 'data-slot': 'badge', '[class]': 'classes()' },
})
export class NeatBadgeButton {
  /** The status the badge states, which sets its colors; `neutral` for a plain label. */
  readonly tone = input<NeatTone>('neutral');
  /** `soft` (the default) shows the tone on a light tint; `solid` fills the badge with it. */
  readonly variant = input<NeatBadgeVariant>('soft');

  protected readonly classes = computed(() => ɵbadgeButtonClasses(this.tone(), this.variant()));
}
