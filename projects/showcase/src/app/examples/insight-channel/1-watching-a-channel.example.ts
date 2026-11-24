import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { NeatCallout } from '@sima/neat-ui/callout';
import { neatInsightChannel } from '@sima/neat-ui/insight';
import { NeatVideoTile } from '@sima/neat-ui/video';

/**
 * A tile that plays Insight's channel 0 and draws its metadata. Its notice says what keeps the
 * video from showing, and its bar what arrives: the codec, the frame size and rate, the bitrate,
 * and how long the browser holds each frame.
 *
 * It needs a running Insight. A page Insight serves reaches it at its own route. An app served by
 * its own server gives `offer` its relay's address. These docs have no Insight behind them, so the
 * tile and the callout say why the channel cannot be watched here.
 *
 * @unpictured
 */
@Component({
  selector: 'app-watching-a-channel',
  imports: [NeatCallout, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-watching-a-channel.example.html',
  styleUrl: './watching-a-channel.example.css',
})
export class WatchingAChannel {
  protected readonly camera = neatInsightChannel(0);
  /** What arrives, for the tile's bar; null until the channel is connected. */
  protected readonly arriving = computed(() => {
    const stats = this.camera.stats();
    if (stats === null) return null;
    const { codec, width, height, framesPerSecond, bitsPerSecond } = stats;
    const held = this.camera.videoDelayMs();
    return [
      codec,
      width === null || height === null ? null : `${width}×${height}`,
      framesPerSecond === null ? null : `${Math.round(framesPerSecond)} fps`,
      `${(bitsPerSecond / 1e6).toFixed(1)} Mbit/s`,
      held === null ? null : `${Math.round(held)} ms buffer`,
    ]
      .filter((part) => part !== null)
      .join(' · ');
  });
}
