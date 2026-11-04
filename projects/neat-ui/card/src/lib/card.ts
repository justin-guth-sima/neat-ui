import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Numbers each card, for the id its title has. */
let nextCardId = 0;

/**
 * Helm's card classes (`lib/ui/card`), copied because helm keeps them inline rather than as
 * constants. card.spec checks that each string still appears in the vendored helm file named
 * here, so a helm update that changes one fails until this table is reviewed.
 *
 * Used as they are: helm's spacing (`--card-spacing`, 1.5rem), ring, shadow, radius and type. The
 * `data-size` classes never match, since the card sets no size. Class strings stay literals:
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
  footer:
    'rounded-b-xl px-(--card-spacing) [.border-t]:pt-(--card-spacing) flex items-center',
} as const;

/**
 * What the kit adds to helm's parts, each once: the header leaves the layout while it has no
 * title, no subtitle and no actions (a card of content only keeps no empty band and no gap for
 * one), and the action area, the content and the footer leave it while empty.
 */
const KIT_CLASSES = {
  header:
    '[&:not(:has([data-slot=card-title],[data-slot=card-description],[data-slot=card-action]:not(:empty)))]:hidden',
  empty: 'empty:hidden',
} as const;

const HEADER_CLASSES = `${CARD_HELM_CLASSES.header} ${KIT_CLASSES.header}`;
const ACTION_CLASSES = `${CARD_HELM_CLASSES.action} ${KIT_CLASSES.empty}`;
const CONTENT_CLASSES = `${CARD_HELM_CLASSES.content} ${KIT_CLASSES.empty}`;
const FOOTER_CLASSES = `${CARD_HELM_CLASSES.footer} ${KIT_CLASSES.empty}`;

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
  protected readonly cardClasses = CARD_HELM_CLASSES.card;
  protected readonly headerClasses = HEADER_CLASSES;
  protected readonly titleClasses = CARD_HELM_CLASSES.title;
  protected readonly descriptionClasses = CARD_HELM_CLASSES.description;
  protected readonly actionClasses = ACTION_CLASSES;
  protected readonly contentClasses = CONTENT_CLASSES;
  protected readonly footerClasses = FOOTER_CLASSES;
}
