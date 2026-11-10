import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev, type NeatBevBounds } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * The rectangle: a metric grid in bounds of the app's, here a square reaching 45 m ahead and
 * 15 m behind, 30 m to either side, labelled along its left and top edges. The view has the round
 * view's height, and the square is fitted inside it, as large as the circle above. Without a
 * height of the app's the view takes the rectangle's proportions; without `bounds` the rectangle
 * is the square of ±`range`. No spokes.
 */
@Component({
  selector: 'app-rect',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-bev shape="rect" [bounds]="bounds" [spokes]="0" [frame]="frame()" />`,
  styleUrl: './bev.example.css',
})
export class Rect {
  protected readonly frame = streetFrames();
  protected readonly bounds: NeatBevBounds = { x: [-15, 45], y: [-30, 30] };
}
