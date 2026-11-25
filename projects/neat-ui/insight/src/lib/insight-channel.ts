import {
  computed,
  DestroyRef,
  effect,
  inject,
  isSignal,
  NgZone,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import type { NeatTileSource } from '@sima/neat-ui/video';
import { openInsightConnection, type NeatInsightVideoStats } from './insight-connection';

/** Where a `neatInsightChannel` posts its offer, how long the browser holds the video, its log. */
export interface NeatInsightChannelOptions {
  /**
   * Where the browser's WebRTC offer is posted: Insight's own route,
   * `/api/channels/{channel}/offer`, by default.
   *
   * That default fits a page Insight serves itself. Insight refuses an offer that a page of
   * another origin sends, so an app served by its own server relays the offer through it and gives
   * that address here. A string is posted to as it is; a function gets the channel:
   *
   * ```ts
   * neatInsightChannel(0, { offer: (channel) => `/api/offer?channel=${channel}` });
   * ```
   *
   * The relay posts the offer to Insight's route and answers with Insight's answer, its errors
   * included.
   */
  readonly offer?: string | ((channel: number) => string);
  /**
   * How long the browser holds the video before it shows a frame, in ms, so each frame's metadata
   * has arrived when it is drawn.
   *
   * It sets the receiver's `jitterBufferTarget`. A signal is followed while the channel is open,
   * so a setting can change it without a new connection. Unset, or in a browser without
   * `jitterBufferTarget` (Firefox, see `videoBufferSupported`), the browser shows each frame as
   * soon as it can.
   */
  readonly videoBufferMs?: number | Signal<number>;
  /**
   * Told each step of the connection (connecting, answered, track, a connection state, a retry
   * and why, a failure, closed), with its details, for an app's debug log. Unset logs nothing.
   *
   * It is called outside Angular, so it should only log.
   */
  readonly log?: (event: string, details?: unknown) => void;
}

/**
 * One Insight channel's video and metadata over WebRTC, as `neatInsightChannel` gives it: a
 * `NeatTileSource` with what an app shows about the connection.
 */
export interface NeatInsightChannel extends NeatTileSource {
  /**
   * What keeps the channel from showing, in a few words, or null while all is well. For the
   * tile's `notice`.
   *
   * While it retries after an answer that says why, it says so: "Waiting for video" (the channel
   * has none yet), "Video format changed", "Insight not reachable" or "Could not connect". Once
   * the offer is refused for good it is `failure`.
   */
  readonly notice: Signal<string | null>;
  /**
   * Null while the channel is connected or still trying; why it stopped once the offer was
   * refused for good.
   *
   * A 4xx answer is final: "Codec not supported by this browser" for a 415, else the answer's own
   * message, or "Connection failed: HTTP 404" when it has none. A browser without WebRTC fails at
   * once. Show it in the page's text as well, such as in a callout: the tile does not announce
   * its notice.
   */
  readonly failure: Signal<string | null>;
  /**
   * The mean time in ms the browser held each frame in its jitter buffer over the last second.
   *
   * It is measured once a second. It is null without a connection or without new frames in that
   * second.
   */
  readonly videoDelayMs: Signal<number | null>;
  /**
   * What arrives on the channel (`NeatInsightVideoStats`: codec, frame size, frame rate,
   * bitrate), measured once a second while it is connected; null while it is not.
   */
  readonly stats: Signal<NeatInsightVideoStats | null>;
  /**
   * Whether this browser can hold the video for `videoBufferMs`: false in a browser without the
   * receiver's `jitterBufferTarget` (Firefox), which shows each frame as soon as it can.
   */
  readonly videoBufferSupported: boolean;
  /**
   * Closes the connection for good, before its injection context is destroyed, such as to open
   * another channel in its place. Calling it again does nothing.
   */
  close(): void;
}

/**
 * One Insight channel's video and metadata over WebRTC, as a source for `neat-video-tile`.
 *
 * ```ts
 * protected readonly camera = neatInsightChannel(0);
 * ```
 *
 * ```html
 * <neat-video-tile [source]="camera" [notice]="camera.notice()" />
 * ```
 *
 * Call it in an injection context. It starts connecting at once and closes the connection when
 * that context is destroyed, with the component that created it. To open a channel later, such
 * as once a setting is read, call it inside `runInInjectionContext` with the component's
 * injector, and `close` the one it replaces.
 *
 * The connection is the one Insight's own viewer makes. The browser posts its offer to `offer`
 * and applies the answer. It receives the video and the `metadata` data channel, whose messages
 * the tile draws. The connection runs outside Angular, and only its signals reach the page.
 *
 * It keeps trying until it is closed. A failed post, or a connection that fails, is tried again
 * after 1, 2 and 5 s, then every 10 s, and a connection that comes up starts that count again.
 * A connection that decodes no new frame for 5 s, or stays disconnected that long, is made anew.
 * This is how it recovers when the pipeline restarts. A 4xx answer is final, and `failure` says
 * why.
 */
export function neatInsightChannel(
  channel: number,
  options: NeatInsightChannelOptions = {},
): NeatInsightChannel {
  const destroyRef = inject(DestroyRef);
  const zone = inject(NgZone);
  const { offer, videoBufferMs, log } = options;
  const offerUrl =
    typeof offer === 'function' ? offer(channel) : (offer ?? `/api/channels/${channel}/offer`);
  const bufferMs = isSignal(videoBufferMs) ? videoBufferMs : () => videoBufferMs;

  const stream = signal<MediaStream | null>(null);
  const waiting = signal<string | null>(null);
  const failure = signal<string | null>(null);
  const videoDelayMs = signal<number | null>(null);
  const stats = signal<NeatInsightVideoStats | null>(null);
  const listeners = new Set<(text: string, receivedAt: number) => void>();

  const connection = zone.runOutsideAngular(() =>
    openInsightConnection(
      { offerUrl, videoBufferMs: untracked(bufferMs), log },
      {
        stream: (value) => stream.set(value),
        // The channel shows streams only, so far: a run of frames is not passed on.
        frames: () => undefined,
        waiting: (text) => waiting.set(text),
        failure: (text) => failure.set(text),
        videoDelayMs: (ms) => videoDelayMs.set(ms),
        stats: (value) => stats.set(value),
        metadata: (text, receivedAt) => {
          for (const listener of listeners) listener(text, receivedAt);
        },
      },
    ),
  );
  if (isSignal(videoBufferMs)) {
    // Ends with the injection context, as the connection does; after `close` it changes nothing.
    effect(() => {
      const ms = videoBufferMs();
      untracked(() => connection.setVideoBufferMs(ms));
    });
  }
  const stopOnDestroy = destroyRef.onDestroy(() => connection.close());

  return {
    stream: stream.asReadonly(),
    notice: computed(() => failure() ?? waiting()),
    failure: failure.asReadonly(),
    videoDelayMs: videoDelayMs.asReadonly(),
    stats: stats.asReadonly(),
    videoBufferSupported:
      typeof RTCRtpReceiver === 'function' && 'jitterBufferTarget' in RTCRtpReceiver.prototype,
    onMetadata(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      stopOnDestroy();
      connection.close();
    },
  };
}
