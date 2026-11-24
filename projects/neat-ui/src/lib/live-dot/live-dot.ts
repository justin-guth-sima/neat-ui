import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A small red dot that says something is live or recording.
 *
 * ```html
 * <neat-live-dot pulse /> Recording 0:34
 * ```
 *
 * It is hidden from assistive technology. The text beside it carries the meaning, so give it text.
 *
 * With `pulse`, the dot beats and a ring grows out of it and fades, once in 1.6 s. Without it, or
 * under a reduced-motion setting, it is a still dot. The ring is drawn outside the dot's 0.625rem
 * box and does not move the layout. An ancestor that clips its overflow clips the ring too.
 *
 * The color is the theme's `--neat-live`, a red that reads at 3:1 on the page and on the video
 * scrim, over black to mid-gray video, so a badge over video can use it: `NeatLiveBadge` does.
 */
@Component({
  selector: 'neat-live-dot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <span class="dot" [class.beat]="pulse()"></span>
    @if (pulse()) {
      <span class="ring"></span>
    }
  `,
  styleUrl: './live-dot.css',
})
export class NeatLiveDot {
  /** Beat and send out a ring, for a state that is running now. */
  readonly pulse = input(false, { transform: booleanAttribute });
}
