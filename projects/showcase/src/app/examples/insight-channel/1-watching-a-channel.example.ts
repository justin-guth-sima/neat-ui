import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { NeatCallout } from '@sima/neat-ui/callout';
import { neatInsightChannel } from '@sima/neat-ui/insight';
import { NeatVideoTile } from '@sima/neat-ui/video';

/**
 * A tile that plays Insight's channel 0 and draws its metadata. Its notice says what keeps the
 * video from showing, and its bar how long the browser holds each frame.
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
  /** How long the browser holds each frame, for the tile's bar; null until it is measured. */
  protected readonly held = computed(() => {
    const ms = this.camera.videoDelayMs();
    return ms === null ? null : `${Math.round(ms)} ms buffer`;
  });
}
