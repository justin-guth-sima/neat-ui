import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * With `overflow="visible"`, nothing stops at the shape: the data and the guides run on over the
 * whole box.
 *
 * The shape still sets the scale, fitted in the box as before. The rest is extra view. Above is a
 * grid that fills a wide box, and below are the rings running on past the range, both at the same
 * 40 m range.
 *
 * Neither draws an outline. With nothing cut at the shape, its edge would only cross the picture.
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
      <neat-bev class="wide" overflow="visible" [outline]="false" [range]="40" [frame]="frame()" />
    </div>
  `,
  styleUrl: './bev.example.css',
})
export class Overflow {
  protected readonly frame = streetFrames();
}
