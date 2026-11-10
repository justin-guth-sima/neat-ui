import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev, type NeatBevBounds } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * The rectangle: a metric grid, in bounds of the app's, labeled along its left and top edges.
 *
 * Here the bounds reach 80 m ahead and 40 m behind, and 60 m to either side. They span 120 m as the
 * circle above does, in a view of the same height, so the two show the street at one scale. There
 * are no spokes.
 *
 * Without a height of the app's, the view takes the rectangle's proportions. Without `bounds`, the
 * rectangle is the square of ±`range`.
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
  protected readonly bounds: NeatBevBounds = { x: [-40, 80], y: [-60, 60] };
}
