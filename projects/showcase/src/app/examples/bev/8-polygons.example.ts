import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { roadFrames } from './roads';

/**
 * Areas as polygons instead of grids: the drivable area of a small road network, given as pieces
 * the way a map gives them.
 *
 * Each piece is a line with `fill`: - a wide four-lane ring road with rounded corners; - a narrow
 * road straight through it, with square crossings; - a side road joining it, with rounded corners;
 * - a ramp branching off it in a curve.
 *
 * The pieces overlap where the roads meet. A label's polygons fill as one area, so the joins do not
 * show.
 *
 * The vehicle drives round the ring, with traffic in every lane. The view stays the vehicle's, so
 * the world turns around it. With `zoom`, try scrolling or pinching to zoom, and dragging to pan.
 *
 * @animated
 */
@Component({
  selector: 'app-polygons',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './8-polygons.example.html',
  styleUrl: './bev.example.css',
})
export class Polygons {
  protected readonly frame = roadFrames();
}
