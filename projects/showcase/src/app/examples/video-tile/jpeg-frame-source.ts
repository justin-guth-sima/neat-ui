import { signal } from '@angular/core';
import type {
  NeatEncodedFrame,
  NeatEncodedFrames,
  NeatMetadataMessage,
  NeatTileSource,
} from '@sima/neat-ui/video';
import { FRAMES_PER_SECOND, HEIGHT, WIDTH } from './canvas-source';
import { BOX, paintTestPattern } from './test-pattern-source';

/** RTP's video clock runs at 90 kHz, so a frame at 30 a second is 3,000 ticks. */
const TICKS_PER_FRAME = 90_000 / FRAMES_PER_SECOND;
/** How long the tile holds a frame, so its metadata has arrived when it is drawn. */
const HOLD_MS = 100;
/** Metadata comes after its frame, as a model's results do. */
const METADATA_DELAY_MS = 40;
const JPEG_QUALITY = 0.8;

/**
 * A test pattern encoded as JPEG frames in the browser, as Insight sends them, so a tile can
 * draw encoded frames without a server. Each frame carries an RTP timestamp that steps 3,000
 * ticks, and its metadata (an `object-detection` and a `classification` message) comes about
 * 40 ms later with that timestamp in `_insight.rtp_timestamp`, so the tile's hold, not luck, lands
 * the overlays on their frame. Pausing stops the frames, so the tile goes stopped.
 */
export class JpegFrameSource implements NeatTileSource {
  readonly stream = signal<MediaStream | null>(null);
  readonly frames = signal<NeatEncodedFrames | null>(null);

  private readonly metadataListeners = new Set<(text: string, receivedAt: number) => void>();
  private readonly frameListeners = new Set<(frame: NeatEncodedFrame) => void>();
  private readonly pendingMetadata = new Set<ReturnType<typeof setTimeout>>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private frame = 0;
  private paused = false;

  onMetadata(listener: (text: string, receivedAt: number) => void): () => void {
    this.metadataListeners.add(listener);
    return () => this.metadataListeners.delete(listener);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Starts the frames; does nothing where canvases cannot encode (as in unit tests). */
  start(document: Document): void {
    const canvas = document.createElement('canvas');
    if (typeof canvas.toBlob !== 'function') return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d');
    if (context === null) return;
    this.frames.set({
      onFrame: (listener) => {
        this.frameListeners.add(listener);
        return () => this.frameListeners.delete(listener);
      },
    });
    this.timer = setInterval(() => {
      if (!this.paused) this.emit(canvas, context);
    }, 1000 / FRAMES_PER_SECOND);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    for (const pending of this.pendingMetadata) clearTimeout(pending);
    this.pendingMetadata.clear();
    this.frames.set(null);
    this.frameListeners.clear();
    this.metadataListeners.clear();
  }

  private emit(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
    const index = this.frame;
    this.frame += 1;
    const { x, y } = paintTestPattern(context, index);
    const rtpTimestamp = index * TICKS_PER_FRAME;
    canvas.toBlob(
      (data) => {
        if (data === null || this.timer === undefined) return;
        const arrival = performance.now();
        for (const listener of this.frameListeners) {
          listener({ data, rtpTimestamp, presentAt: arrival + HOLD_MS });
        }
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
    const pending = setTimeout(() => {
      this.pendingMetadata.delete(pending);
      this.send(
        {
          type: 'object-detection',
          data: {
            objects: [{ label: 'box', confidence: 0.92, bbox: [x, y, BOX.width, BOX.height] }],
          },
          _insight: { rtp_timestamp: rtpTimestamp },
        },
        {
          type: 'classification',
          data: { top_classes: [{ label: `frame ${index}`, confidence: 0.9 }] },
          _insight: { rtp_timestamp: rtpTimestamp },
        },
      );
    }, METADATA_DELAY_MS);
    this.pendingMetadata.add(pending);
  }

  private send(...messages: NeatMetadataMessage[]): void {
    const receivedAt = performance.now();
    for (const message of messages) {
      const text = JSON.stringify(message);
      for (const listener of this.metadataListeners) listener(text, receivedAt);
    }
  }
}
