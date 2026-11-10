import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { CAMERAS, SEAMS, streetFrames } from './scene';

/**
 * A six-camera rig. On the left, its seams as spokes: each halfway between two neighbouring
 * cameras, from the vehicle's centre, irregular since the back camera is wider. On the right, the
 * cameras themselves as sensors: each one's edges from where it is mounted, in its own colour, so
 * the gaps and overlaps between them show. A sensor with `fill` is also filled, faintly.
 */
@Component({
  selector: 'app-camera-seams',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pair">
      <figure>
        <neat-bev [frame]="frame()" [spokes]="seams" [range]="30" />
        <figcaption>Seams from the centre</figcaption>
      </figure>
      <figure>
        <neat-bev [frame]="frame()" [sensors]="cameras" [spokes]="0" [range]="30" />
        <figcaption>Cameras from their mounts</figcaption>
      </figure>
    </div>
  `,
  styleUrl: './bev.example.css',
})
export class CameraSeams {
  protected readonly frame = streetFrames();
  protected readonly cameras = CAMERAS;
  protected readonly seams = SEAMS;
}
