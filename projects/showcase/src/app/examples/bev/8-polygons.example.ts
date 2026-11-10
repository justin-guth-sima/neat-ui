import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { roadFrames } from './roads';

/**
 * Areas as polygons instead of grids: the drivable area of a small road network, given as pieces
 * the way a map gives them, each a line with `fill`. A wide four-lane ring road with rounded
 * corners, a narrow road straight through it with square crossings, a side road joining it with
 * rounded corners, and a ramp branching off it in a curve. The pieces overlap where the roads
 * meet, and a label's polygons fill as one area, so the joins do not show. The vehicle drives round
 * the ring with traffic in every lane: the view stays the vehicle's, so the world turns around it.
 * With `zoom`: scroll or pinch to zoom, drag to pan.
 */
@Component({
  selector: 'app-polygons',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-bev zoom [frame]="frame()" />`,
  styleUrl: './bev.example.css',
})
export class Polygons {
  protected readonly frame = roadFrames();
}
