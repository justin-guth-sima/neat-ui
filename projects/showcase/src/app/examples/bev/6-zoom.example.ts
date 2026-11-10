import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * With `zoom`, the view zooms and pans. On the left the guides lie over the data, the default. On
 * the right they lie under it.
 *
 * The circle zooms with what it holds, in to four times the default. Every wheel over the view is
 * its own, so the page does not scroll away under the pointer. Without `zoom`, the default, the
 * wheel scrolls the page.
 *
 * Try scrolling or pinching to zoom and dragging to pan, then reset with the button that shows. Or
 * focus the view and use the arrow keys, `+`, `-` and `0`.
 */
@Component({
  selector: 'app-zoom',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pair">
      <figure>
        <neat-bev zoom [frame]="frame()" [range]="40" />
        <figcaption>Guides over the data</figcaption>
      </figure>
      <figure>
        <neat-bev zoom guides="under" [frame]="frame()" [range]="40" />
        <figcaption>Guides under the data</figcaption>
      </figure>
    </div>
  `,
  styleUrl: './bev.example.css',
})
export class Zoom {
  protected readonly frame = streetFrames();
}
