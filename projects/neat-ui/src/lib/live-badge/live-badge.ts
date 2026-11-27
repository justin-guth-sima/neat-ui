import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BADGE_SHAPE_CLASSES } from '../badge/badge-classes';
import { NeatLiveDot } from '../live-dot/live-dot';

/**
 * A pill that says what a picture is: "Live", with the pulsing live dot, or what shows instead
 * ("File preview", "Not live"), with a still gray dot of the same size, so the pill keeps its size
 * as the state changes.
 *
 * ```html
 * <neat-live-badge live onPicture>Live</neat-live-badge>
 * ```
 *
 * `onPicture` puts it on the video scrim, which reads over any frame; without it the pill is muted,
 * for an empty frame. The app says which, since only it knows whether a picture shows yet. The
 * app places it too, usually in the picture's top-left corner (the video tile's `neatTileOverlay`
 * layer). Its shape, text size and weight are the badge's; its colors are its own, since they must
 * read over any video. The text is the badge's meaning; the dots are hidden from assistive
 * technology.
 */
@Component({
  selector: 'neat-live-badge',
  imports: [NeatLiveDot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'shape', '[attr.data-on-picture]': 'onPicture() || null' },
  template: `
    @if (live()) {
      <neat-live-dot pulse />
    } @else {
      <span class="idle" aria-hidden="true"></span>
    }
    <ng-content />
  `,
  styleUrl: './live-badge.css',
})
export class NeatLiveBadge {
  /** The badge's shape; the sheet sets the colors and the dot's gap. */
  protected readonly shape = BADGE_SHAPE_CLASSES;

  /** The picture is live: the pulsing live dot leads the text, instead of a still gray one. */
  readonly live = input(false, { transform: booleanAttribute });
  /** It sits on a picture: on the video scrim, instead of the muted pill of an empty frame. */
  readonly onPicture = input(false, { transform: booleanAttribute });
}
