import { SIMA_PALETTE } from '@sima/neat-ui';
import { CanvasSource, HEIGHT, WIDTH } from './canvas-source';

/** The turning box: its center, its size and how far it turns each frame, in radians. */
const CENTER = [WIDTH / 2, HEIGHT / 2] as const;
const SIZE = [220, 90] as const;
const TURN_PER_FRAME = 0.02;

/** A box of an `object-detection` message: its upright extent and the rotated box itself. */
export interface RotatedShip {
  readonly label: string;
  readonly confidence: number;
  /** `[x, y, width, height]`, the smallest upright box around the rotated one. */
  readonly bbox: readonly [number, number, number, number];
  /** `[centerX, centerY, width, height, angle]`, the angle in radians, clockwise on screen. */
  readonly oriented_bbox: readonly [number, number, number, number, number];
}

/** The ship of frame `frame`: a box that turns once every 10.5 s at 30 frames a second. */
export function rotatedShip(frame: number): RotatedShip {
  const angle = frame * TURN_PER_FRAME;
  const [cx, cy] = CENTER;
  const [w, h] = SIZE;
  const width = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
  const height = Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle));
  return {
    label: 'ship',
    confidence: 0.91,
    bbox: [cx - width / 2, cy - height / 2, width, height],
    oriented_bbox: [cx, cy, w, h, angle],
  };
}

/** A dark picture with a ship that turns slowly, and an `object-detection` message per frame. */
export class RotatedBoxSource extends CanvasSource {
  private frame = 0;

  protected paint(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = SIMA_PALETTE.text;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const ship = rotatedShip(this.frame);
    const [cx, cy, w, h, angle] = ship.oriented_bbox;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = SIMA_PALETTE.backgroundAlt;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    this.send({ type: 'object-detection', data: { objects: [ship] } });
    this.frame += 1;
  }
}
