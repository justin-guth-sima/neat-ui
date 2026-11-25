import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { NeatSwitch } from '@sima/neat-ui/switch';
import { NeatVideoTile } from '@sima/neat-ui/video';
import { RotatedBoxSource } from './rotated-box-source';

/**
 * A detector that finds boxes at an angle sends `oriented_bbox` with each object of an
 * `object-detection` message: `[centerX, centerY, width, height, angle]`, the center and size in
 * video pixels and the angle in radians, turning the box clockwise on screen. The tile draws that
 * box instead of `bbox`, which stays the upright extent around it (the region of interest reads it).
 * An `oriented_bbox` that is not five finite numbers is ignored and `bbox` drawn.
 *
 * The label stands upright at the rotated box's topmost corner, its plate above the corner as for
 * any box. Of two corners equally high it takes the left one, so a box that is not turned labels
 * at its top-left corner, as an upright box does. Watch the label hop from corner to corner as the
 * ship turns. With Mirror on, the picture and the box flip and the label stays at the same corner
 * of the frame, its plate ending at it. With Flip vertical on, the picture turns top to bottom and
 * the label stands at the corner topmost on screen, which is now another corner of the box, its
 * text still upright.
 *
 * @animated
 */
@Component({
  selector: 'app-rotated-boxes',
  imports: [NeatSwitch, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './6-rotated-boxes.example.html',
  styleUrl: './rotated-boxes.example.css',
})
export class RotatedBoxes {
  protected readonly harbor = new RotatedBoxSource();
  protected readonly mirror = signal(false);
  protected readonly flipVertical = signal(false);

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.harbor.start(document));
    inject(DestroyRef).onDestroy(() => this.harbor.stop());
  }
}
