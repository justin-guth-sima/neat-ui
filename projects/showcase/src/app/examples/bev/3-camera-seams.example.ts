import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBev } from '@sima/neat-ui/bev';
import { CAMERAS, MOUNT_EDGES, SEAMS, streetFrames } from './scene';

/**
 * A six-camera rig, each camera's view a faint wedge from where it is mounted. On the left the
 * spokes are the seams between neighbouring cameras, drawn from the vehicle's centre: irregular,
 * since the back camera is wider. On the right they are each camera's own edges, drawn from its
 * mount: where its view really starts, with the gaps and overlaps between cameras. Spokes are a
 * list of angles, each with an origin if it has one.
 */
@Component({
  selector: 'app-camera-seams',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pair">
      <figure>
        <neat-bev [frame]="frame()" [sensors]="cameras" [spokes]="seams" [range]="30" />
        <figcaption>Seams from the centre</figcaption>
      </figure>
      <figure>
        <neat-bev [frame]="frame()" [sensors]="cameras" [spokes]="edges" [range]="30" />
        <figcaption>Edges from the mounts</figcaption>
      </figure>
    </div>
  `,
  styleUrl: './bev.example.css',
})
export class CameraSeams {
  protected readonly frame = streetFrames();
  protected readonly cameras = CAMERAS;
  protected readonly seams = SEAMS;
  protected readonly edges = MOUNT_EDGES;
}
