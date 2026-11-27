import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NeatIcon, type NeatIconGlyph, type NeatIconName } from '@sima/neat-ui';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. They are helm's empty state (`lib/ui/empty/`), copied because helm's directives cannot sit
 * behind a public one; empty.spec reads the vendored files and holds each part to them both ways,
 * so a helm update that adds or drops a class fails until this is reviewed.
 */

/** `hlm-empty.ts`: the dashed, centered column that fills its area. */
const EMPTY_HELM_CLASSES =
  'gap-4 rounded-lg border-dashed p-12 flex w-full min-w-0 flex-1 flex-col items-center justify-center text-center text-balance';
/** `hlm-empty-header.ts`: the icon, the title and the description. */
const HEADER_HELM_CLASSES = 'gap-2 flex max-w-sm flex-col items-center';
/**
 * `hlm-empty-media.ts`: its base and its `icon` variant, which draws the icon on a rounded
 * `--muted` square.
 */
const MEDIA_HELM_CLASSES =
  "mb-2 flex shrink-0 items-center justify-center [&_neat-icon]:pointer-events-none [&_neat-icon]:shrink-0 bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_neat-icon:not([class*='text-'])]:text-[length:--spacing(6)]";
/** `hlm-empty-title.ts`. */
const TITLE_HELM_CLASSES = 'text-lg font-medium tracking-tight';
/** `hlm-empty-description.ts`. */
const DESCRIPTION_HELM_CLASSES =
  'text-sm/relaxed text-muted-foreground [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4';
/** `hlm-empty-content.ts`: the row of actions. */
const CONTENT_HELM_CLASSES =
  'gap-4 text-sm flex w-full max-w-sm min-w-0 flex-col items-center text-balance';

/**
 * What a large area shows when it has nothing to show, and no part of the app is on it:
 *
 * ```html
 * <neat-empty icon="video-off" heading="No streams to show">
 *   Every tile is hidden.
 *   <button neatButton neatEmptyActions type="button">Show all tiles</button>
 * </neat-empty>
 * ```
 *
 * For an area that would otherwise be blank: a tile grid when every tile is hidden, a page with no
 * results yet. It is Spartan's empty state, taken as it is: a dashed, centered column with an
 * optional icon on a rounded square, a heading, a short description and a row of actions. It fills
 * the area it is in, so give that a size.
 *
 * Not for a control or a part that has nothing to say. A video tile's "No signal" is the tile's own
 * note (`notice`), a list that is empty shows a line in the list, and neither is an empty state.
 *
 * The heading is a real heading (`role="heading"`), at `headingLevel`, 3 by default: pick the level
 * that fits where the area stands in the page's outline. The content is the description; elements
 * marked `neatEmptyActions` go to a row under it.
 */
@Component({
  selector: 'neat-empty',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: EMPTY_HELM_CLASSES, 'data-slot': 'empty' },
  template: `
    <div data-slot="empty-header" [class]="headerClasses">
      @if (icon(); as glyph) {
        <div data-slot="empty-media" data-variant="icon" [class]="mediaClasses">
          <neat-icon [name]="glyph" [size]="24" />
        </div>
      }
      <div
        data-slot="empty-title"
        role="heading"
        [class]="titleClasses"
        [attr.aria-level]="headingLevel()"
      >
        {{ heading() }}
      </div>
      <!-- empty:hidden: an empty state with no description keeps no gap for it. -->
      <div data-slot="empty-description" class="empty:hidden" [class]="descriptionClasses">
        <ng-content />
      </div>
    </div>
    <div data-slot="empty-content" class="empty:hidden" [class]="contentClasses">
      <ng-content select="[neatEmptyActions]" />
    </div>
  `,
})
export class NeatEmpty {
  /**
   * The icon on the square above the heading: a name of the kit's set first, and only where none
   * fits a glyph imported from `@sima/neat-ui/lucide`. None shows no square.
   */
  readonly icon = input<NeatIconName | NeatIconGlyph>();
  /** What the area is missing, in a few words. */
  readonly heading = input.required<string>();
  /** The heading's level in the page's outline. */
  readonly headingLevel = input<2 | 3 | 4 | 5 | 6>(3);

  protected readonly headerClasses = HEADER_HELM_CLASSES;
  protected readonly mediaClasses = MEDIA_HELM_CLASSES;
  protected readonly titleClasses = TITLE_HELM_CLASSES;
  protected readonly descriptionClasses = DESCRIPTION_HELM_CLASSES;
  protected readonly contentClasses = CONTENT_HELM_CLASSES;
}
