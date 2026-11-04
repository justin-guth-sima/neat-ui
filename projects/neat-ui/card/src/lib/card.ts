import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Numbers each card, for the id its title has. */
let nextCardId = 0;

/**
 * Helm's card classes (`lib/ui/card`), copied because helm keeps them inline rather than as
 * constants. card.spec checks that each string still appears in the vendored helm file named
 * here, so a helm update that changes one fails until this table is reviewed.
 *
 * The kit restyles some of them (below, KIT_CARD). Class strings stay literals:
 * Tailwind finds the classes the kit stylesheet needs by reading them.
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
 * card are one look. Each part names the helm classes it drops and what replaces them, and
 * card.spec checks every dropped class is still in helm's string, so a helm update that renames
 * one fails here instead of leaving two competing classes.
 *
 * - Frame: a 1px `--border` and `--radius` instead of helm's ring, shadow and `rounded-xl`; no
 *   `overflow-hidden`, since a chart's readout can hang below its plot, and no ring or shadow,
 *   since a selected chart card draws a border colour and an inset shadow of its own.
 * - Spacing: `--card-spacing` is `--neat-space-4` (helm's 1.5rem is roomy for a dashboard), and the
 *   parts sit `--neat-space-2` apart.
 * - Type: the title is `text-sm` (`--neat-text-sm`) as a chart card's heading, the subtitle
 *   `text-xs` (`--neat-text-xs`, the size of a chart card's caption: the kit's secondary line).
 * - Header: at least 2rem tall (`min-h-8`), so cards side by side line their content up whether or
 *   not one has actions (a small button is 2rem). The header, the action area, the content and the
 *   footer leave the layout while they hold nothing to show: a card of content only keeps no empty
 *   band and no gap for one.
 */
const KIT_CARD = {
  card: {
    drop: [
      'ring-foreground/10',
      'overflow-hidden',
      'rounded-xl',
      'shadow-xs',
      'ring-1',
      '[--card-spacing:--spacing(6)]',
      'data-[size=sm]:[--card-spacing:--spacing(4)]',
      'gap-(--card-spacing)',
    ],
    add: 'min-w-0 border border-border rounded-(--radius) gap-(--neat-space-2) [--card-spacing:var(--neat-space-4)]',
  },
  header: {
    drop: ['rounded-t-xl'],
    add: 'min-h-8 [&:not(:has([data-slot=card-title],[data-slot=card-description],[data-slot=card-action]:not(:empty)))]:hidden',
  },
  title: { drop: ['text-base'], add: 'text-sm' },
  description: { drop: ['text-sm'], add: 'text-xs' },
  action: { drop: [], add: 'empty:hidden' },
  content: { drop: [], add: 'empty:hidden' },
  footer: { drop: ['rounded-b-xl'], add: 'empty:hidden' },
} as const;

/** The kit's classes for a part: helm's without the dropped ones, then the kit's. */
export function kitCardClasses(part: keyof typeof KIT_CARD): string {
  const { drop, add } = KIT_CARD[part];
  const kept = CARD_HELM_CLASSES[part]
    .split(' ')
    .filter((cls) => !(drop as readonly string[]).includes(cls));
  return [...kept, add].join(' ');
}

/** Exposed for card.spec, which holds each dropped class to helm's string. */
export const CARD_KIT_DROPPED = KIT_CARD;

/**
 * A card on Spartan's, with an optional title and subtitle, actions beside them and a footer:
 *
 * ```html
 * <neat-card title="Detections" subtitle="Last minute">
 *   <button neatButton neatCardActions type="button" size="small">Clear</button>
 *   <p>Nothing yet.</p>
 *   <p neatCardFooter>Updated now</p>
 * </neat-card>
 * ```
 *
 * The title stands at the start of the header, the subtitle under it; elements with the attribute
 * `neatCardActions` go to the header's end, elements with `neatCardFooter` to the footer, and
 * everything else is the content. The attributes are selectors of the card, not directives, so
 * they need no import and cannot be forgotten into silence. The header, the footer and the
 * actions area are always in the template and leave the layout while empty: a card without a
 * title, a subtitle or actions has no header, and actions alone still sit at the header's end.
 *
 * With a title the host is a named region (`role="region"`, labelled by the title), the landmark
 * a `section` with a name maps to; a custom element is not a `section` of its own. Without a
 * title it has no role, since a region with no name is no landmark. The title is an `h2`: cards
 * are a page's sections. The card sets `--neat-surface` to its fill, for the charts it holds.
 */
@Component({
  selector: 'neat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'card',
    '[class]': 'cardClasses',
    '[attr.role]': 'title() ? "region" : null',
    '[attr.aria-labelledby]': 'title() ? titleId : null',
    // The title is an input, so the attribute must not stay on the host as a native tooltip.
    '[attr.title]': 'null',
  },
  template: `
    <div data-slot="card-header" [class]="headerClasses">
      @if (title()) {
        <h2 data-slot="card-title" [class]="titleClasses" [id]="titleId">{{ title() }}</h2>
      }
      @if (subtitle()) {
        <p data-slot="card-description" [class]="descriptionClasses">{{ subtitle() }}</p>
      }
      <div data-slot="card-action" [class]="actionClasses">
        <ng-content select="[neatCardActions]" />
      </div>
    </div>
    <div data-slot="card-content" [class]="contentClasses"><ng-content /></div>
    <div data-slot="card-footer" [class]="footerClasses">
      <ng-content select="[neatCardFooter]" />
    </div>
  `,
  styleUrl: './card.css',
})
export class NeatCard {
  /** The card's title, which also names it as a region; none if empty. */
  readonly title = input('');
  /** A line under the title; none if empty. */
  readonly subtitle = input('');

  protected readonly titleId = `neat-card-${++nextCardId}-title`;
  protected readonly cardClasses = kitCardClasses('card');
  protected readonly headerClasses = kitCardClasses('header');
  protected readonly titleClasses = kitCardClasses('title');
  protected readonly descriptionClasses = kitCardClasses('description');
  protected readonly actionClasses = kitCardClasses('action');
  protected readonly contentClasses = kitCardClasses('content');
  protected readonly footerClasses = kitCardClasses('footer');
}
