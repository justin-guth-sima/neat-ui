import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { roadFrames } from './roads';

/**
 * Areas as polygons instead of grids: the drivable area of a small road network, given as pieces
 * the way a map gives them, each a line with `fill`. A wide four-lane road; behind the vehicle a
 * narrow side road joining from the left with rounded corners; ahead a narrow road crossing with
 * straight corners; past it a ramp branching off to the right in a curve, which the planned path
 * takes. The pieces overlap where the roads meet, and a label's polygons fill as one area, so the
 * joins do not show. With `zoom`: scroll or pinch to zoom, drag to pan.
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
