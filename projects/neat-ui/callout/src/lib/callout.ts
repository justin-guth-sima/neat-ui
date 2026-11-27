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
 * them. Colors are the theme's tokens only; callout.spec holds the text to 4.5:1 on every tone's
 * tint in both schemes.
 */

/**
 * Helm's alert base (`lib/ui/alert/src/lib/hlm-alert.ts`, its `alertVariants` base), copied
 * because helm keeps it inline: the bordered card, the icon in a column of its own beside the
 * text, `neat-icon` where helm writes the icon's tag. callout.spec reads the vendored file and
 * holds the host to helm's classes both ways, so a helm update that adds or drops one fails until
 * this is reviewed. Not helm's `hlmAlert` directive: it sets `role="alert"`, which here is the
 * app's choice (`announce`, `region`).
 */
const ALERT_HELM_CLASSES =
  "grid gap-0.5 rounded-lg border px-4 py-3 text-start text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>neat-icon]:grid-cols-[auto_1fr] has-[>neat-icon]:gap-x-2.5 *:[neat-icon]:row-span-2 *:[neat-icon]:translate-y-0.5 *:[neat-icon]:text-current *:[neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] group/alert relative w-full";
/** Helm's default variant: the card's fill and text. Neutral takes it as it is. */
const ALERT_DEFAULT_HELM_CLASSES = 'bg-card text-card-foreground';
/**
 * Helm's title and description (`hlm-alert-title.ts`, `hlm-alert-description.ts`) with one
 * departure each, which callout.spec names: the title's `col-start-2`, since the kit's content
 * column holds both (`col-start-2` on the column), and the description's muted text color, since
 * the text color is the tone's.
 */
const TITLE_CLASSES =
  'font-medium [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3';
const DESCRIPTION_CLASSES =
  'text-sm text-balance md:text-pretty [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3';

/**
 * Each tone's tint, border and text color, which the heading, the icon (helm's `text-current`)
 * and the body take. The tint is the select list's row tint (an opaque mix over `--background`),
 * the border the tone mixed toward `--border`, the text the tone's color, warning's through
 * `--neat-warning-text` since its own color is a fill. Neutral is helm's default card, whose
 * description is muted.
 *
 * The tints are opaque mixes over `--background`: in a dark dialog the fill is the page's color,
 * not the dialog's surface. The tint, the words and the icon carry the tone there.
 */
const TONES: Record<NeatTone, { readonly host: string; readonly body: string }> = {
  neutral: { host: ALERT_DEFAULT_HELM_CLASSES, body: 'text-muted-foreground' },
  success: {
    host: 'bg-neat-tint-success border-neat-callout-border-success text-success',
    body: '',
  },
  warning: {
    host: 'bg-neat-tint-warning border-neat-callout-border-warning text-neat-warning-text',
    body: '',
  },
  danger: {
    host: 'bg-neat-tint-danger border-neat-callout-border-danger text-destructive',
    body: '',
  },
  info: { host: 'bg-neat-tint-info border-neat-callout-border-info text-info', body: '' },
  highlight: {
    host: 'bg-neat-tint-highlight border-neat-callout-border-highlight text-highlight',
    body: '',
  },
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
 * A note set apart on a tint of its tone, with an optional heading and a row of actions:
 *
 * ```html
 * <neat-callout tone="warning" heading="Board changed" announce="status">
 *   The board at 192.168.1.20 replaced the previous one.
 *   <button neatButton neatCalloutActions type="button">Refresh</button>
 * </neat-callout>
 * ```
 *
 * For a banner over a page, a problem or a guide in a dialog, a note in a panel. `tone` (a
 * `NeatTone`, `info` by default) picks the tint, the border and the color of the icon, heading
 * and text, and the icon: `error` for danger, `warning`, `check` for success, `info` otherwise.
 * It is Spartan's alert in the kit's tones: a bordered card with the icon in a column beside the
 * heading and text. Neutral is Spartan's plain card. A short notice reads well in the tone's
 * color; for a longer one, set `plainText` and only the heading and icon keep it. The content is
 * the body; elements marked `neatCalloutActions` go to a row under it.
 *
 * The heading is a real heading (`role="heading"`), at `headingLevel`, 3 by default. That puts it
 * under a dialog's title (a level 2) or a page's section, where heading navigation finds it. Pick
 * the level that fits where the callout stands.
 *
 * The tint is the page's color mixed with the tone, so in a dialog it differs from the dialog's own
 * surface.
 *
 * `region` makes the callout a landmark, for a notice a user should be able to jump to, such as
 * the Viewer's late notice. The heading names it. Without a heading the callout takes no role,
 * since a region with no name is no landmark.
 *
 * `announce` instead gives the host a live role, to say the note with when it appears. Use
 * `status` for news that can wait, and `alert` for a failure that needs attention now. It wins over
 * `region`, since a host has one role.
 *
 * A callout with a role is labeled by its heading (`aria-labelledby`). One without a role is a
 * plain note. A live region speaks what is added to it, so render the callout when its news
 * happens (an `@if`), not hidden beforehand.
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
    <neat-icon [name]="icon()" [size]="16" />
    <div data-slot="callout-content" class="col-start-2 flex min-w-0 flex-col gap-0.5">
      @if (heading()) {
        <div
          data-slot="callout-heading"
          role="heading"
          [class]="titleClasses"
          [id]="headingId"
          [attr.aria-level]="headingLevel()"
        >
          {{ heading() }}
        </div>
      }
      <!-- empty:hidden: a callout with no body (a heading and actions) keeps no gap for it. -->
      <div data-slot="callout-body" class="empty:hidden" [class]="bodyClasses()">
        <ng-content />
      </div>
      <div
        data-slot="callout-actions"
        class="mt-(--neat-space-2) flex flex-wrap items-center gap-(--neat-space-2) empty:hidden"
      >
        <ng-content select="[neatCalloutActions]" />
      </div>
    </div>
  `,
})
export class NeatCallout {
  /** The kind of note: sets the tint, the border, the text color and the icon. */
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

  /**
   * Sets the body in the normal text color, for a longer note: the heading and the icon keep the
   * tone's color. A short notice reads well in the tone's color; a paragraph does not.
   */
  readonly plainText = input(false, { transform: booleanAttribute });

  protected readonly titleClasses = TITLE_CLASSES;
  protected readonly headingId = `neat-callout-${++nextCalloutId}-heading`;
  protected readonly role = computed(
    () => this.announce() ?? (this.region() && this.heading() ? 'region' : null),
  );

  protected readonly classes = computed(() => `${ALERT_HELM_CLASSES} ${TONES[this.tone()].host}`);
  protected readonly icon = computed(() => ICONS[this.tone()]);
  protected readonly bodyClasses = computed(
    () =>
      `${DESCRIPTION_CLASSES} ${this.plainText() ? 'text-foreground' : TONES[this.tone()].body}`,
  );
}
