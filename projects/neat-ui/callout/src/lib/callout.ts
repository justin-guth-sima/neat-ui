import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NeatIcon, type NeatIconName, type NeatTone } from '@sima/neat-ui';

/** Numbers each callout, for the id its heading has. */
let nextCalloutId = 0;

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. Colours are the theme's tokens only; callout.spec holds the text to 4.5:1 and the icon to
 * 3:1 on every tone's fill in both schemes.
 */

/** The box: the fill, a start border in the tone's colour, and the icon beside the text. */
const CALLOUT_CLASSES =
  'flex gap-(--neat-space-3) rounded-(--radius) border-s-4 p-(--neat-space-3) text-sm text-foreground';

/**
 * Each tone's fill, start border and icon. The fill is the tone's tint (the select list's row
 * tints, opaque mixes over `--background`), `--muted` for neutral, whose border and icon are the
 * muted text colour. The icon takes the tone's solid colour where that holds 3:1 on the tint;
 * warning's (about 2:1 on its light tint) does not, so its icon is `--foreground` in both schemes
 * and the border alone carries the colour. The icon's shape and the words carry the tone too.
 *
 * The tints are opaque mixes over `--background`: on a raised surface (a dialog, a popover) the
 * fill is the page's colour, not the surface's, and neutral's `--muted` is a dark dialog's own
 * surface. There the border and the icon carry the tone, not the fill.
 */
const TONES: Record<NeatTone, { readonly classes: string; readonly icon: string }> = {
  neutral: { classes: 'bg-muted border-muted-foreground', icon: 'text-muted-foreground' },
  success: { classes: 'bg-neat-tint-success border-success', icon: 'text-success' },
  warning: { classes: 'bg-neat-tint-warning border-warning', icon: 'text-foreground' },
  danger: { classes: 'bg-neat-tint-danger border-destructive', icon: 'text-destructive' },
  info: { classes: 'bg-neat-tint-info border-info', icon: 'text-info' },
  highlight: { classes: 'bg-neat-tint-highlight border-highlight', icon: 'text-highlight' },
};

/** The icon by tone: the glyph says the kind of note before the words do. */
const ICONS: Record<NeatTone, NeatIconName> = {
  neutral: 'info',
  success: 'check',
  warning: 'warning',
  danger: 'error',
  info: 'info',
  highlight: 'info',
};

/**
 * A note set apart on a status tint, with an optional heading and a row of actions:
 *
 * ```html
 * <neat-callout tone="warning" heading="Board changed" announce="status">
 *   The board at 192.168.1.20 replaced the previous one.
 *   <button neatButton neatCalloutActions type="button">Refresh</button>
 * </neat-callout>
 * ```
 *
 * For a banner over a page, a problem or a guide in a dialog, a note in a panel. `tone` (a
 * `NeatTone`, `info` by default) picks the fill, the start border and the icon: `error` for
 * danger, `warning`, `check` for success, `info` otherwise. The content is the body; elements
 * marked `neatCalloutActions` go to a row under it.
 *
 * The heading is a real heading (`role="heading"`), at `headingLevel`, 3 by default: under a
 * dialog's title (a level 2) or a page's section, as heading navigation finds it. Pick the level
 * that fits where the callout stands.
 *
 * The fill is the page's colour mixed with the tone (see TONES), so in a dialog it differs from
 * the dialog's own surface, and a neutral callout in a dark one shows by its border and icon.
 *
 * `region` makes the callout a landmark, for a notice a user should be able to jump to (the
 * Viewer's late notice); the heading names it, and without a heading the callout takes no role,
 * since a region with no name is no landmark. `announce` gives the host the live
 * role to say the note with when it appears instead: `status` for news that can wait, `alert` for
 * a failure that needs attention now; it wins over `region`, since a host has one role. A callout
 * with a role is labelled by its heading (`aria-labelledby`); one with none is simply there. A
 * live region speaks what is added to it, so render the callout when its news happens (an `@if`),
 * not hidden beforehand.
 */
@Component({
  selector: 'neat-callout',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.role]': 'role()',
    '[attr.aria-labelledby]': 'role() && heading() ? headingId : null',
  },
  template: `
    <neat-icon [name]="icon()" [size]="16" [class]="iconClasses()" />
    <div class="flex min-w-0 flex-1 flex-col gap-(--neat-space-2)">
      @if (heading()) {
        <div
          data-slot="callout-heading"
          role="heading"
          class="font-medium"
          [id]="headingId"
          [attr.aria-level]="headingLevel()"
        >
          {{ heading() }}
        </div>
      }
      <!-- empty:hidden: a callout with no body (a heading and actions) keeps no gap for it. -->
      <div data-slot="callout-body" class="empty:hidden"><ng-content /></div>
      <div
        data-slot="callout-actions"
        class="flex flex-wrap items-center gap-(--neat-space-2) empty:hidden"
      >
        <ng-content select="[neatCalloutActions]" />
      </div>
    </div>
  `,
})
export class NeatCallout {
  /** The kind of note: sets the fill, the start border and the icon. */
  readonly tone = input<NeatTone>('info');
  /** A short heading over the body; none if empty. */
  readonly heading = input('');
  /** The heading's level in the page's outline. */
  readonly headingLevel = input<2 | 3 | 4 | 5 | 6>(3);
  /**
   * Whether the callout is a landmark, named by its heading (none without one); a live role wins
   * over it.
   */
  readonly region = input(false, { transform: booleanAttribute });
  /** The live role the note is said with when it appears; none by default. */
  readonly announce = input<'status' | 'alert' | null>(null);

  protected readonly headingId = `neat-callout-${++nextCalloutId}-heading`;
  protected readonly role = computed(
    () => this.announce() ?? (this.region() && this.heading() ? 'region' : null),
  );

  protected readonly classes = computed(() => `${CALLOUT_CLASSES} ${TONES[this.tone()].classes}`);
  protected readonly icon = computed(() => ICONS[this.tone()]);
  /** Level with the first line of text (`text-sm` is 20px high, the icon 16px). */
  protected readonly iconClasses = computed(() => `mt-0.5 shrink-0 ${TONES[this.tone()].icon}`);
}
