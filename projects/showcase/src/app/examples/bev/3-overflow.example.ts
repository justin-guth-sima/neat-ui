import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * With `overflow="visible"` nothing stops at the shape: the data and the guides run on over the
 * whole box. The shape still sets the scale, fitted in the box as before; the rest is extra view.
 * Above, a grid that fills a wide box without an outline; below, the rings running on past the
 * range, its outline still marking where the range ends.
 */
@Component({
  selector: 'app-overflow',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <neat-bev
        class="wide"
        shape="rect"
        overflow="visible"
        [outline]="false"
        [range]="40"
        [spokes]="0"
        [frame]="frame()"
      />
      <neat-bev class="wide" overflow="visible" [range]="30" [frame]="frame()" />
    </div>
  `,
  styleUrl: './bev.example.css',
})
export class Overflow {
  protected readonly frame = streetFrames();
}
