import type { Signal } from '@angular/core';

/**
 * Where a `neat-video-tile` gets its video and metadata: a stream or encoded frames. The tile knows
 * nothing about how they arrive (WebRTC, a file, a canvas); the app implements this for its
 * transport.
 */
export interface NeatTileSource {
  /** The channel's video, or null while connecting or when it has none. */
  readonly stream: Signal<MediaStream | null>;
  /**
   * The channel's pictures as encoded frames, for video the browser cannot play as a stream
   * (RTP/JPEG), or null while it has none. At most one of `stream` and `frames` is set at a time. If both are set, the tile plays the
   * stream and says so once in dev mode.
   * A new value is a new run of frames, as a new `MediaStream` is a new stream: the tile forgets
   * the old run's metadata and overlays. Leave it out for a source that only has streams.
   */
  readonly frames?: Signal<NeatEncodedFrames | null>;
  /**
   * Registers a listener for raw metadata text; returns the unsubscribe function. `receivedAt` is
   * on the `performance.now()` clock, the one presented frames are timed with.
   */
  onMetadata(listener: (text: string, receivedAt: number) => void): () => void;
}

/**
 * One run of encoded frames. `onFrame` registers a listener for each frame that arrives from now
 * on and returns the unsubscribe function. Several tiles may listen to one run; each decodes the
 * frames itself.
 */
export interface NeatEncodedFrames {
  onFrame(listener: (frame: NeatEncodedFrame) => void): () => void;
}

/** One picture of a run of encoded frames, with the time the tile may show it. */
export interface NeatEncodedFrame {
  /** The picture, in a format `createImageBitmap` decodes: JPEG from Insight. */
  readonly data: Blob;
  /**
   * The RTP timestamp its metadata carries as `_insight.rtp_timestamp`, so the tile draws each
   * frame with the metadata that describes it, in every browser. Null matches metadata by
   * arrival, as a stream without timestamps does.
   */
  readonly rtpTimestamp: number | null;
  /**
   * The earliest time the tile may show it, on the `performance.now()` clock: its arrival plus
   * the source's hold, so its metadata has arrived when it is drawn. The arrival time itself
   * shows it at once.
   */
  readonly presentAt: number;
}
