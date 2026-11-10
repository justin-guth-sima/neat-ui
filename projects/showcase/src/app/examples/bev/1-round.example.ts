import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * The round view, as a radar shows it: rings every 10 m out to the 60 m range, spokes every 30°,
 * and the street around a vehicle waiting at a crossing, 20 frames a second. The drivable area is
 * a 128 × 128 grid, the lidar's returns one array of points, the lane markings and the planned
 * turn lines, and every car, cyclist and person a box with its heading. Each label takes its
 * color from the page's class colors, as a video tile's classes do. Everything stops at the
 * circle, the guides lie over the data, and hovering or tapping a box reads it out.
 */
@Component({
  selector: 'app-round',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<neat-bev [frame]="frame()" />`,
  styleUrl: './bev.example.css',
})
export class Round {
  protected readonly frame = streetFrames();
}
