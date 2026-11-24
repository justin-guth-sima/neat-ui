import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { neatInsightChannel } from '@sima/neat-ui/insight';
import { NeatSlider } from '@sima/neat-ui/slider';
import { NeatVideoTile } from '@sima/neat-ui/video';

/**
 * A setting for how long the browser holds the video, so that each frame's metadata has arrived
 * when the frame is drawn. The channel follows the slider's signal without connecting anew, and
 * the line under it says how long the browser holds each frame, or that this browser cannot.
 *
 * @unpictured
 */
@Component({
  selector: 'app-holding-the-video',
  imports: [NeatSlider, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-holding-the-video.example.html',
  styleUrl: './watching-a-channel.example.css',
})
export class HoldingTheVideo {
  protected readonly bufferMs = signal(300);
  protected readonly camera = neatInsightChannel(1, { videoBufferMs: this.bufferMs });
  protected readonly held = computed(() => {
    if (!this.camera.videoBufferSupported) return 'This browser shows each frame at once.';
    const ms = this.camera.videoDelayMs();
    return ms === null ? 'Not measured yet.' : `Each frame is held ${Math.round(ms)} ms.`;
  });
}
