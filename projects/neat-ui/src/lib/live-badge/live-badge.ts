import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
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
 * layer). The text is the badge's meaning; the dots are hidden from assistive technology.
 */
@Component({
  selector: 'neat-live-badge',
  imports: [NeatLiveDot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-on-picture]': 'onPicture() || null' },
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
  /** The picture is live: the pulsing live dot leads the text, instead of a still gray one. */
  readonly live = input(false, { transform: booleanAttribute });
  /** It sits on a picture: on the video scrim, instead of the muted pill of an empty frame. */
  readonly onPicture = input(false, { transform: booleanAttribute });
}
