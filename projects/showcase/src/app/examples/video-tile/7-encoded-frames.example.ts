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
import { JpegFrameSource } from './jpeg-frame-source';

/**
 * A source whose `frames` are encoded pictures, here JPEG, is drawn by the tile on a canvas of its
 * own instead of in a video element, which is how the tile shows video the browser cannot play as
 * a stream. Each frame carries the RTP timestamp its metadata names in `_insight.rtp_timestamp`,
 * and the tile holds the frame until `presentAt`, so the boxes and the label are drawn on the
 * frame they describe, in every browser. This source encodes a test pattern in the page, so no
 * server is needed.
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

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.jpegFrames.start(document));
    inject(DestroyRef).onDestroy(() => this.jpegFrames.stop());
  }
}
