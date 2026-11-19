import { signal } from '@angular/core';
import type { NeatMetadataMessage, NeatTileSource } from '@sima/neat-ui/video';

export const WIDTH = 640;
export const HEIGHT = 360;
export const FRAMES_PER_SECOND = 30;

/**
 * What the showcase's sources share, so a tile plays without vf: a canvas streamed with
 * `captureStream()`, painted 30 times a second, and the metadata listeners. Each source paints a
 * frame and sends the metadata that describes it. A canvas stream has no RTP timestamps, so the
 * tile matches metadata by arrival, which takes only the latest message: hence one type a source.
 */
export abstract class CanvasSource implements NeatTileSource {
  readonly stream = signal<MediaStream | null>(null);

  private readonly listeners = new Set<(text: string, receivedAt: number) => void>();
  private animation = 0;
  private lastPaintAt = 0;

  onMetadata(listener: (text: string, receivedAt: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts the stream; does nothing where canvases cannot be streamed (as in unit tests). */
  start(document: Document): void {
    const canvas = document.createElement('canvas');
    if (typeof canvas.captureStream !== 'function') return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d');
    if (context === null) return;
    this.stream.set(canvas.captureStream(FRAMES_PER_SECOND));
    const loop = (now: number) => {
      this.animation = requestAnimationFrame(loop);
      if (now - this.lastPaintAt < 1000 / FRAMES_PER_SECOND) return;
      this.lastPaintAt = now;
      this.paint(context);
    };
    this.animation = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.animation);
    for (const track of this.stream()?.getTracks() ?? []) track.stop();
    this.stream.set(null);
    this.listeners.clear();
  }

  /** Paints the next frame on `ctx` and sends its metadata. Painting nothing presents no frame. */
  protected abstract paint(ctx: CanvasRenderingContext2D): void;

  protected send(message: NeatMetadataMessage): void {
    const text = JSON.stringify(message);
    const receivedAt = performance.now();
    for (const listener of this.listeners) listener(text, receivedAt);
  }
}
