import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ɵhlm as hlm } from '@sima/neat-ui';

/** Numbers each card, for the id its title has. */
let nextCardId = 0;

/**
 * Helm's card classes (`lib/ui/card`), copied because helm keeps them inline rather than as
 * constants. card.spec checks that each string still appears in the vendored helm file named
 * here, so a helm update that changes one fails until this table is reviewed.
 *
 * The kit restyles some of them (below, CARD_CLASSES).
 */
export const CARD_HELM_CLASSES = {
  /** `hlm-card.ts`: the card, a column of header, content and footer one spacing apart. */
  card: 'ring-foreground/10 bg-card text-card-foreground gap-(--card-spacing) overflow-hidden rounded-xl py-(--card-spacing) text-sm shadow-xs ring-1 [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl group/card flex flex-col',
  /** `hlm-card-header.ts`: title and subtitle in a column, the action beside them. */
  header:
    'gap-1 rounded-t-xl px-(--card-spacing) [.border-b]:pb-(--card-spacing) group/card-header @container/card-header grid auto-rows-min items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]',
  /** `hlm-card-title.ts` */
  title: 'text-base leading-normal font-medium group-data-[size=sm]/card:text-sm',
  /** `hlm-card-description.ts` */
  description: 'text-muted-foreground text-sm',
  /** `hlm-card-action.ts`: the header's second column, over both its rows. */
  action: 'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
  /** `hlm-card-content.ts` */
  content: 'px-(--card-spacing)',
  /** `hlm-card-footer.ts` */
  footer: 'rounded-b-xl px-(--card-spacing) [.border-t]:pt-(--card-spacing) flex items-center',
} as const;

/**
 * The kit's card look, from helm's: the frame the chart card has always had, so a card and a chart
 * card are one look. Each part is helm's string merged with the kit's classes (`hlm`, as the
 * dialog's panel is), so a kit class replaces the helm class of its kind and the neutralizers
 * (`ring-0`, `shadow-none`, `overflow-visible`, `rounded-t-none`, ...) replace the helm classes
 * the kit has no use for. A helm update that renames one shows up as drift in card.spec, and a
 * class that no longer merges away shows in its look test. Class strings stay literals: Tailwind
 * finds the classes the kit stylesheet needs by reading them.
 *
 * - Frame: a 1px `--border` and `--radius` instead of helm's ring, shadow and `rounded-xl`; no
 *   `overflow-hidden`, since a chart's readout can hang below its plot, and no ring or shadow,
 *   since a selected chart card draws a border color and an inset shadow of its own.
 * - Spacing: `--card-spacing` is `--neat-space-4` (helm's 1.5rem is roomy for a dashboard), and the
 *   parts sit `--neat-space-2` apart.
 * - Type: the title is `text-sm` (`--neat-text-sm`) as a chart card's heading, the subtitle
 *   `text-xs` (`--neat-text-xs`, the size of a chart card's caption: the kit's secondary line).
 * - Subtitle: always in the first column, under the title: with no actions in the header it would
 *   otherwise be placed in the second column, beside the title.
 * - Actions: a row of their own, so an action that is an inline element (a chip) takes its own
 *   height and no line box of the text around it adds to it.
 * - Header: the row gap only with a subtitle (helm's `gap-1` also left a gap under a title alone,
 *   where the actions' two-row span makes an empty second row), and at least 2rem tall, so cards
 *   side by side line their content up whether or not one has actions (a small button is 2rem).
 *   The minimum is the custom property `--neat-card-header-min-height` (2rem unless set), for the
 *   kit's own presets whose actions are smaller (a chart card's chip); an app sizes a card by its
 *   actions, not by this. The header, the action area, the content and the footer leave the layout
 *   while they hold nothing to show: a card of content only keeps no empty band and no gap for one.
 * - Content: it takes the height the card has left (`flex-1 min-h-0`), so a card a grid row
 *   stretches gives its content the rest, an image can fill an untitled card, and the footers of
 *   cards in a row line up.
 * - Footer: several elements sit `--neat-space-2` apart.
 */
export const CARD_CLASSES = {
  card: hlm(
    CARD_HELM_CLASSES.card,
    'min-w-0 border border-border rounded-(--radius) ring-0 shadow-none overflow-visible gap-(--neat-space-2) [--card-spacing:var(--neat-space-4)]',
  ),
  header: hlm(
    CARD_HELM_CLASSES.header,
    '@container-normal/card-header rounded-t-none gap-0 gap-x-1 has-data-[slot=card-description]:gap-y-1 min-h-[var(--neat-card-header-min-height,2rem)] [&:not(:has([data-slot=card-title]:not(:empty),[data-slot=card-description],[data-slot=card-action]:not(:empty)))]:hidden',
  ),
  // `text-sm` replaces the line height too, under twMerge: `leading-normal` is set again.
  title: hlm(CARD_HELM_CLASSES.title, 'text-sm leading-normal'),
  description: hlm(CARD_HELM_CLASSES.description, 'text-xs col-start-1'),
  action: hlm(CARD_HELM_CLASSES.action, 'flex items-center gap-(--neat-space-2) empty:hidden'),
  content: hlm(CARD_HELM_CLASSES.content, 'flex-1 min-h-0 empty:hidden'),
  footer: hlm(CARD_HELM_CLASSES.footer, 'rounded-b-none gap-(--neat-space-2) empty:hidden'),
} as const;

/**
 * A card: a surface with an optional title and subtitle, actions beside them and a footer:
 *
 * ```html
 * <neat-card title="Detections" subtitle="Last minute">
 *   <button neatButton neatCardActions type="button" size="small">Clear</button>
 *   <p>Nothing yet.</p>
 *   <p neatCardFooter>Updated now</p>
 * </neat-card>
 * ```
 *
 * The title stands at the start of the header, with the subtitle under it. Elements marked
 * `neatCardActions` go to the header's end, and elements marked `neatCardFooter` to the footer.
 * Everything else is the content.
 *
 * An element marked `neatCardTitle`, such as a button, stands in the title's place as it is,
 * inside the title's element. With `title` text as well, that element is in the heading and names
 * the region. Without it, the card has no heading role.
 *
 * The attributes are selectors of the card, not directives, so they need no import and cannot be
 * forgotten into silence.
 *
 * The header, the footer and the actions area are always in the template, and leave the layout
 * while empty. So a card without a title, a subtitle or actions has no header, and actions alone
 * still sit at the header's end.
 *
 * The title is a real heading (`role="heading"`), at `headingLevel`, 3 by default, as the
 * callout's is. Pick the level that fits where the card stands.
 *
 * `region` makes the card a landmark (`role="region"`, labeled by the title), for a card a user
 * should be able to jump to. Without a title it takes no role, since a region with no name is no
 * landmark.
 *
 * The card sets `--neat-surface` to its fill, for the charts it holds.
 */
@Component({
  selector: 'neat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'card',
    '[class]': 'classes.card',
    '[attr.role]': 'region() && title() ? "region" : null',
    '[attr.aria-labelledby]': 'region() && title() ? titleId : null',
    // The title is an input, so the attribute must not stay on the host as a native tooltip.
    '[attr.title]': 'null',
  },
  template: `
    <div data-slot="card-header" [class]="classes.header">
      <!-- Always there: an element marked neatCardTitle fills it with no title text. -->
      <div
        data-slot="card-title"
        [class]="classes.title"
        [id]="titleId"
        [attr.role]="title() ? 'heading' : null"
        [attr.aria-level]="title() ? headingLevel() : null"
      >
        <ng-content select="[neatCardTitle]">{{ title() }}</ng-content>
      </div>
      @if (subtitle()) {
        <p data-slot="card-description" [class]="classes.description">{{ subtitle() }}</p>
      }
      <div data-slot="card-action" [class]="classes.action">
        <ng-content select="[neatCardActions]" />
      </div>
    </div>
    <div data-slot="card-content" [class]="classes.content"><ng-content /></div>
    <div data-slot="card-footer" [class]="classes.footer">
      <ng-content select="[neatCardFooter]" />
    </div>
  `,
  styleUrl: './card.css',
})
export class NeatCard {
  /** The card's title, a heading at `headingLevel`; none if empty. */
  readonly title = input('');
  /** The title's level in the page's outline. */
  readonly headingLevel = input<2 | 3 | 4 | 5 | 6>(3);
  /** Whether the card is a landmark, named by its title (none without one). */
  readonly region = input(false, { transform: booleanAttribute });
  /** A line under the title; none if empty. */
  readonly subtitle = input('');

  protected readonly titleId = `neat-card-${++nextCardId}-title`;
  protected readonly classes = CARD_CLASSES;
}
