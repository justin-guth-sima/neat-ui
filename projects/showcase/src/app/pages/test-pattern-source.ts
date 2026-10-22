import { signal } from '@angular/core';
import { type NeatMetadataMessage, type NeatTileSource, SIMA_PALETTE } from '@sima/neat-ui';

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
const BOX = { width: 120, height: 90 };
/** Detections come every other frame, as from a model slower than the video; the tile holds them. */
const DETECTION_EVERY = 2;

/**
 * A `NeatTileSource` for the showcase, so the tile plays without vf: a canvas test pattern streamed
 * with `captureStream()`, and object-detection metadata for the box moving across it. A canvas
 * stream has no RTP timestamps, so the tile matches metadata by arrival, which takes only the latest
 * message: hence one type. Pausing stops painting, so the stream presents no frames and the tile
 * goes stopped.
 */
export class TestPatternSource implements NeatTileSource {
  readonly stream = signal<MediaStream | null>(null);

  private readonly listeners = new Set<(text: string, receivedAt: number) => void>();
  private context: CanvasRenderingContext2D | null = null;
  private animation = 0;
  private lastPaintAt = 0;
  private frame = 0;
  private paused = false;

  onMetadata(listener: (text: string, receivedAt: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts the pattern; does nothing where canvases cannot be streamed (as in unit tests). */
  start(document: Document): void {
    const canvas = document.createElement('canvas');
    if (typeof canvas.captureStream !== 'function') return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.context = canvas.getContext('2d');
    if (this.context === null) return;
    this.stream.set(canvas.captureStream(FRAMES_PER_SECOND));
    const loop = (now: number) => {
      this.animation = requestAnimationFrame(loop);
      if (this.paused || now - this.lastPaintAt < 1000 / FRAMES_PER_SECOND) return;
      this.lastPaintAt = now;
      this.paint();
    };
    this.animation = requestAnimationFrame(loop);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  stop(): void {
    cancelAnimationFrame(this.animation);
    for (const track of this.stream()?.getTracks() ?? []) track.stop();
    this.stream.set(null);
    this.listeners.clear();
  }

  private paint(): void {
    const ctx = this.context;
    if (ctx === null) return;
    const barWidth = WIDTH / BAR_COLORS.length;
    BAR_COLORS.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(i * barWidth, 0, barWidth, HEIGHT);
    });

    // The box bounces between the edges, four pixels per frame.
    const travel = WIDTH - BOX.width;
    const step = (this.frame * 4) % (2 * travel);
    const x = step < travel ? step : 2 * travel - step;
    const y = (HEIGHT - BOX.height) / 2;
    ctx.fillStyle = SIMA_PALETTE.text;
    ctx.fillRect(x, y, BOX.width, BOX.height);
    ctx.fillStyle = SIMA_PALETTE.white;
    ctx.font = '500 20px sans-serif';
    ctx.fillText(String(this.frame), x + 12, y + 32);

    if (this.frame % DETECTION_EVERY === 0) {
      this.send({
        type: 'object-detection',
        data: {
          objects: [{ label: 'box', confidence: 0.92, bbox: [x, y, BOX.width, BOX.height] }],
        },
      });
    }
    this.frame += 1;
  }

  private send(message: NeatMetadataMessage): void {
    const text = JSON.stringify(message);
    const receivedAt = performance.now();
    for (const listener of this.listeners) listener(text, receivedAt);
  }
}
