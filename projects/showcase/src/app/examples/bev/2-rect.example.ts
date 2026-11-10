import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev, type NeatBevBounds } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * The rectangle: a metric grid in bounds of the app's, here 45 m ahead and 15 m behind, 40 m to
 * either side, labelled along its left and top edges. Without a height of the app's the view
 * takes the rectangle's proportions; with one, the rectangle is fitted inside it. Without
 * `bounds` it is the square of ±`range`. No spokes.
 */
@Component({
  selector: 'app-rect',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-bev
    class="own-height"
    shape="rect"
    [bounds]="bounds"
    [spokes]="0"
    [frame]="frame()"
  />`,
  styleUrl: './bev.example.css',
})
export class Rect {
  protected readonly frame = streetFrames();
  protected readonly bounds: NeatBevBounds = { x: [-15, 45], y: [-40, 40] };
}
