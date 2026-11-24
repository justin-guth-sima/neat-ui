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
 * no metadata.
 */
export class ColorBarsSource implements NeatTileSource {
  readonly stream = signal<MediaStream | null>(null);

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
    const barWidth = WIDTH / BAR_COLORS.length;
    BAR_COLORS.forEach((color, i) => {
      context.fillStyle = color;
      context.fillRect(i * barWidth, 0, barWidth, HEIGHT);
    });
    this.stream.set(canvas.captureStream(FRAMES_PER_SECOND));
  }

  stop(): void {
    for (const track of this.stream()?.getTracks() ?? []) track.stop();
    this.stream.set(null);
  }
}
