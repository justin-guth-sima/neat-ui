<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Insight channel

_Components › Video_ · [All topics](../README.md)

One Insight channel's video and metadata over WebRTC, as a source for `neat-video-tile`.

```ts
protected readonly camera = neatInsightChannel(0);
```

```ts
import { neatInsightChannel } from '@sima/neat-ui/insight';
```

## Examples

### Watching a channel

A tile that plays Insight's channel 0 and draws its metadata. Its notice says what keeps the video from showing, and its bar what arrives: the codec, the frame size and rate, the bitrate, and how long the browser holds each frame.

It needs a running Insight. A page Insight serves reaches it at its own route. An app served by its own server gives `offer` its relay's address. These docs have no Insight behind them, so the tile and the callout say why the channel cannot be watched here.

<details>
<summary>Code</summary>

`1-watching-a-channel.example.ts`

```ts
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { NeatCallout } from '@sima/neat-ui/callout';
import { neatInsightChannel } from '@sima/neat-ui/insight';
import { NeatVideoTile } from '@sima/neat-ui/video';

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
```

`1-watching-a-channel.example.html`

```html
@if (camera.failure(); as failure) {
  <neat-callout tone="danger" heading="Channel 0 cannot be watched">{{ failure }}</neat-callout>
}
<div class="cell">
  <neat-video-tile
    label="Channel 0"
    [source]="camera"
    [notice]="camera.notice()"
    [status]="arriving()"
  />
</div>
```

`watching-a-channel.example.css`

```css
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
}

/* A tile fills its cell, so the cell gives it a size: a 16:9 box up to 32rem wide. */
.cell {
  aspect-ratio: 16 / 9;
  max-width: 32rem;
}
```

</details>

### Holding the video

A setting for how long the browser holds the video, so that each frame's metadata has arrived when the frame is drawn. The channel follows the slider's signal without connecting anew, and the line under it says how long the browser holds each frame, or that this browser cannot.

<details>
<summary>Code</summary>

`2-holding-the-video.example.ts`

```ts
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { neatInsightChannel } from '@sima/neat-ui/insight';
import { NeatSlider } from '@sima/neat-ui/slider';
import { NeatVideoTile } from '@sima/neat-ui/video';

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
```

`2-holding-the-video.example.html`

```html
<div class="cell">
  <neat-video-tile label="Channel 1" [source]="camera" [notice]="camera.notice()" />
</div>
<neat-slider label="Video buffer" [min]="0" [max]="1000" [step]="50" [(value)]="bufferMs" />
<span class="showcase-muted">{{ bufferMs() }} ms. {{ held() }}</span>
```

`watching-a-channel.example.css`

```css
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
}

/* A tile fills its cell, so the cell gives it a size: a 16:9 box up to 32rem wide. */
.cell {
  aspect-ratio: 16 / 9;
  max-width: 32rem;
}
```

</details>

## API

### `neatInsightChannel`

Function from `@sima/neat-ui/insight`.

```html
<neat-video-tile [source]="camera" [notice]="camera.notice()" />
```

Call it in an injection context. It starts connecting at once and closes the connection when that context is destroyed, with the component that created it. To open a channel later, such as once a setting is read, call it inside `runInInjectionContext` with the component's injector, and `close` the one it replaces.

The connection is the one Insight's own viewer makes. The browser posts its offer to `offer` and applies the answer. It receives the video and the `metadata` data channel, whose messages the tile draws. The connection runs outside Angular, and only its signals reach the page.

It keeps trying until it is closed. A failed post, or a connection that fails, is tried again after 1, 2 and 5 s, then every 10 s, and a connection that comes up starts that count again. A connection that decodes no new frame for 5 s, or stays disconnected that long, is made anew. This is how it recovers when the pipeline restarts. A 4xx answer is final, and `failure` says why.

```ts
neatInsightChannel(channel: number, options: NeatInsightChannelOptions = {}): NeatInsightChannel
```

### `NeatInsightChannel`

Interface from `@sima/neat-ui/insight`.

One Insight channel's video and metadata over WebRTC, as [`neatInsightChannel`](../components/insight-channel.md#neatinsightchannel) gives it: a [`NeatTileSource`](../components/video-tile.md#neattilesource) with what an app shows about the connection.

**Members**

- **`notice`** `Signal<string | null>`

  What keeps the channel from showing, in a few words, or null while all is well. For the tile's `notice`.

  While it retries after an answer that says why, it says so: "Waiting for video" (the channel has none yet), "Video format changed", "Insight not reachable" or "Could not connect". Once the offer is refused for good it is `failure`.

- **`failure`** `Signal<string | null>`

  Null while the channel is connected or still trying; why it stopped once the offer was refused for good.

  A 4xx answer is final: "Codec not supported by this browser" for a 415, else the answer's own message, or "Connection failed: HTTP 404" when it has none. A browser without WebRTC fails at once. Show it in the page's text as well, such as in a callout: the tile does not announce its notice.

- **`videoDelayMs`** `Signal<number | null>`

  The mean time in ms the browser held each frame in its jitter buffer over the last second.

  It is measured once a second. It is null without a connection or without new frames in that second.

- **`stats`** `Signal<NeatInsightVideoStats | null>`

  What arrives on the channel ([`NeatInsightVideoStats`](../components/insight-channel.md#neatinsightvideostats): codec, frame size, frame rate, bitrate), measured once a second while it is connected; null while it is not.

- **`videoBufferSupported`** `boolean`

  Whether this browser can hold the video for `videoBufferMs`: false in a browser without the receiver's `jitterBufferTarget` (Firefox), which shows each frame as soon as it can.

**Methods**

- **`close`**

  ```ts
  close(): void
  ```

  Closes the connection for good, before its injection context is destroyed, such as to open another channel in its place. Calling it again does nothing.

### `NeatInsightChannelOptions`

Interface from `@sima/neat-ui/insight`.

Where a [`neatInsightChannel`](../components/insight-channel.md#neatinsightchannel) posts its offer, how long the browser holds the video, its log.

**Members**

- **`offer`** `string | ((channel: number) => string)`, optional

  Where the browser's WebRTC offer is posted: Insight's own route, `/api/channels/{channel}/offer`, by default.

  That default fits a page Insight serves itself. Insight refuses an offer that a page of another origin sends, so an app served by its own server relays the offer through it and gives that address here. A string is posted to as it is; a function gets the channel:

  ```ts
  neatInsightChannel(0, { offer: (channel) => `/api/offer?channel=${channel}` });
  ```

  The relay posts the offer to Insight's route and answers with Insight's answer, its errors included.

- **`videoBufferMs`** `number | Signal<number>`, optional

  How long the browser holds the video before it shows a frame, in ms, so each frame's metadata has arrived when it is drawn.

  It sets the receiver's `jitterBufferTarget`. A signal is followed while the channel is open, so a setting can change it without a new connection. Unset, or in a browser without `jitterBufferTarget` (Firefox, see `videoBufferSupported`), the browser shows each frame as soon as it can.

- **`log`** `(event: string, details?: unknown) => void`, optional

  Told each step of the connection (connecting, answered, track, a connection state, a retry and why, a failure, closed), with its details, for an app's debug log. Unset logs nothing.

  It is called outside Angular, so it should only log.

### `NeatInsightVideoStats`

Interface from `@sima/neat-ui/insight`.

What arrives on a connected channel, sampled once a second.

**Members**

- **`codec`** `string | null`

  The video's codec as the browser names it ("H264", "H265", "VP8"), or null before it says.

- **`width`** `number | null`

  The decoded frame's size in pixels, or null before the browser reports it.

- **`height`** `number | null`

- **`framesPerSecond`** `number | null`

  Decoded frames per second, or null before the browser reports it.

- **`bitsPerSecond`** `number`

  The video's bitrate over the last second, in bits per second.
