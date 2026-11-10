import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A small red dot that says something is live or recording, as `<neat-live-dot pulse />` before
 * the words "Recording 0:34". Hidden from assistive technology: the text beside it carries the
 * meaning, so give it text. With `pulse` the dot beats and a ring grows out of it and fades, once
 * in 1.6 s; without it, or under a reduced-motion setting, it is a still dot. The ring is drawn
 * outside the dot's 0.625rem box and does not move the layout, but an ancestor that clips its
 * overflow clips the ring too. The color is the theme's `--neat-live`, a red that reads at 3:1 on
 * the page and on the video scrim (over black to mid-gray video), so a badge over video can use it.
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
