import { signal } from '@angular/core';
import { SIMA_PALETTE } from '@sima/neat-ui';
import type { NeatTileSource } from '@sima/neat-ui/video';

const WIDTH = 640;
const HEIGHT = 360;
const FRAMES_PER_SECOND = 30;
const BAR_COLORS = [
  SIMA_PALETTE.orange,
  SIMA_PALETTE.purple,
  SIMA_PALETTE.blue,
  SIMA_PALETTE.mint,
  SIMA_PALETTE.green,
  SIMA_PALETTE.lime,
];

/**
 * Color bars for a tile to play without a server: a canvas streamed with `captureStream()`, with
 * no metadata. It paints every frame, since a stream that presents none is one the tile shows as
 * stopped.
 */
export class ColorBarsSource implements NeatTileSource {
  readonly stream = signal<MediaStream | null>(null);

  private animation = 0;

  onMetadata(): () => void {
    return () => undefined;
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
    const barWidth = WIDTH / BAR_COLORS.length;
    const paint = () => {
      this.animation = requestAnimationFrame(paint);
      BAR_COLORS.forEach((color, i) => {
        context.fillStyle = color;
        context.fillRect(i * barWidth, 0, barWidth, HEIGHT);
      });
    };
    this.animation = requestAnimationFrame(paint);
  }

  stop(): void {
    cancelAnimationFrame(this.animation);
    for (const track of this.stream()?.getTracks() ?? []) track.stop();
    this.stream.set(null);
  }
}
