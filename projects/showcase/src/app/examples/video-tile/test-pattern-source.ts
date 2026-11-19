import { SIMA_PALETTE } from '@sima/neat-ui';
import { CanvasSource, HEIGHT, WIDTH } from './canvas-source';

const BAR_COLORS = [
  SIMA_PALETTE.orange,
  SIMA_PALETTE.purple,
  SIMA_PALETTE.blue,
  SIMA_PALETTE.mint,
  SIMA_PALETTE.green,
  SIMA_PALETTE.lime,
];
const BOX = { width: 120, height: 90 };
/** Detections come every other frame, as from a model slower than the video; held between. */
const DETECTION_EVERY = 2;

/**
 * A canvas test pattern, with object-detection metadata for the box moving across it: one type,
 * as the tile matches a canvas stream's metadata by arrival. Pausing stops painting, so the stream
 * presents no frames and the tile goes stopped.
 */
export class TestPatternSource extends CanvasSource {
  private frame = 0;
  private paused = false;

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  protected paint(ctx: CanvasRenderingContext2D): void {
    if (this.paused) return;
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
}
