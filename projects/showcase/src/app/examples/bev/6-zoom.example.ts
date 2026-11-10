import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * With `zoom` the view zooms and pans: scroll or pinch to zoom, drag to pan, and reset with the
 * button that then shows (or focus the view and use the arrows, `+`, `-` and `0`). The circle
 * zooms with what it holds, in to four times the default, and every wheel over the view is its
 * own, so the page does not scroll away under the pointer. Without `zoom` (the default) the wheel
 * scrolls the page. On the left the guides lie over the data (the default), on the right under it.
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
