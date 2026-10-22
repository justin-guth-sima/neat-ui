import type { Signal } from '@angular/core';

/**
 * Where a `neat-video-tile` gets its video and metadata. The tile knows nothing about how they
 * arrive (WebRTC, a file, a canvas); the app implements this for its transport.
 */
export interface NeatTileSource {
  /** The channel's video, or null while connecting or when it has none. */
  readonly stream: Signal<MediaStream | null>;
  /**
   * Registers a listener for raw metadata text; returns the unsubscribe function. `receivedAt` is
   * on the `performance.now()` clock, the one presented frames are timed with.
   */
  onMetadata(listener: (text: string, receivedAt: number) => void): () => void;
}
