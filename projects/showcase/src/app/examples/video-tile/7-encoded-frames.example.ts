import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { SIMA_PALETTE } from '@sima/neat-ui';
import { NeatSwitch } from '@sima/neat-ui/switch';
import {
  NEAT_OVERLAY_DEFAULTS,
  type NeatOverlaySettings,
  NeatVideoTile,
} from '@sima/neat-ui/video';
import { JpegFrameSource } from './jpeg-frame-source';

/**
 * A source whose `frames` are encoded pictures, here JPEG, is drawn by the tile on a canvas of its
 * own instead of in a video element, which is how the tile shows video the browser cannot play as
 * a stream. Each frame carries the RTP timestamp its metadata names in `_insight.rtp_timestamp`,
 * and the tile holds the frame until `presentAt`, so the boxes and the label are drawn on the
 * frame they describe, in every browser. This source encodes a test pattern in the page, so no
 * server is needed.
 *
 * The number over the box is the label of that frame's detection, and the number painted in the
 * picture is the frame's own: the two match while the overlay lands on its frame. The `objects` row
 * labeled `default` draws every label in white, so the label does not take a new class color each
 * frame.
 *
 * Turn Mirror on; pause the frames to see the tile go stopped.
 */
@Component({
  selector: 'app-encoded-frames',
  imports: [NeatSwitch, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './7-encoded-frames.example.html',
  styleUrl: './rotated-boxes.example.css',
})
export class EncodedFrames {
  protected readonly jpegFrames = new JpegFrameSource();
  protected readonly mirror = signal(false);
  protected readonly settings: NeatOverlaySettings = {
    ...NEAT_OVERLAY_DEFAULTS,
    types: {
      ...NEAT_OVERLAY_DEFAULTS.types,
      'object-detection': {
        ...NEAT_OVERLAY_DEFAULTS.types['object-detection'],
        objects: [{ label: 'default', color: SIMA_PALETTE.white, style: 'solid', width: 1 }],
      },
    },
  };

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.jpegFrames.start(document));
    inject(DestroyRef).onDestroy(() => this.jpegFrames.stop());
  }
}
