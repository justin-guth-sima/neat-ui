import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { streetFrames } from './scene';

/**
 * The round view, as a radar shows it: the street around a vehicle waiting at a crossing, 20 frames
 * a second.
 *
 * It has rings every 10 m out to the 60 m range, and spokes every 30°. The drivable area is a 128 ×
 * 128 grid, and the lidar's returns are one array of points. The lane markings and the planned turn
 * are lines, and every car, cyclist and person is a box with its heading.
 *
 * Each label takes its color from the page's class colors, as a video tile's classes do. Everything
 * stops at the circle, and the guides lie over the data. Try hovering or tapping a box to read it
 * out.
 *
 * @gallery
 * @animated
 */
@Component({
  selector: 'app-round',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-round.example.html',
  styleUrl: './bev.example.css',
})
export class Round {
  protected readonly frame = streetFrames();
}
