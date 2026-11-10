import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { BUILDINGS, SAFETY_ZONE, streetFrames } from './scene';

/**
 * What the app draws besides the frame, which changes rarely.
 *
 * Under the data (`background`) are the buildings' footprints from a map, as polygons. Over it
 * (`foreground`) is a dashed zone the vehicle keeps clear ahead of it.
 *
 * Both take lines, polygons and points, in their labels' colors. They are drawn with the view's
 * cached layers, not every frame. A camera's field of view, a geofence or a map's lane lines go the
 * same way.
 */
@Component({
  selector: 'app-layers',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-bev
    [frame]="frame()"
    [background]="buildings"
    [foreground]="zone"
    [range]="40"
  />`,
  styleUrl: './bev.example.css',
})
export class Layers {
  protected readonly frame = streetFrames();
  protected readonly buildings = BUILDINGS;
  protected readonly zone = SAFETY_ZONE;
}
