import { SIMA_PALETTE } from '@sima/neat-ui';
import { CanvasSource, HEIGHT, WIDTH } from './canvas-source';

/** The vehicles on the road, each in its lane, pixels per frame, and size. */
const VEHICLES = [
  { label: 'car', lane: 0, speed: 3, width: 90, height: 50, start: 120 },
  { label: 'truck', lane: 1, speed: 2, width: 150, height: 70, start: 260 },
  { label: 'car', lane: 0, speed: 3, width: 80, height: 46, start: 380 },
  { label: 'car', lane: 1, speed: 2, width: 90, height: 50, start: 560 },
] as const;
const LANES = [120, 250];
/** How far a vehicle drives before it enters again, as a new track. */
const LAP = WIDTH + 200;

/** A track in a `tracking` message: its id, label and box in video pixels. */
export interface RoadTrack {
  readonly id: number;
  readonly label: string;
  readonly confidence: number;
  readonly bbox: readonly [number, number, number, number];
}

/**
 * The tracks of frame `frame`: four vehicles driving left to right in two lanes. Each time one
 * enters again from the left it is a new track, with the next id.
 */
export function roadTracks(frame: number): readonly RoadTrack[] {
  return VEHICLES.map((vehicle, i): RoadTrack => {
    const driven = vehicle.start + frame * vehicle.speed;
    const lap = Math.floor(driven / LAP);
    const x = (driven % LAP) - vehicle.width;
    const y = LANES[vehicle.lane] - vehicle.height / 2;
    return {
      id: 1 + i + lap * VEHICLES.length,
      label: vehicle.label,
      confidence: 0.9,
      bbox: [x, y, vehicle.width, vehicle.height],
    };
  }).filter(({ bbox: [x, , width] }) => x + width > 0 && x < WIDTH);
}

/** A dark road with vehicles driving across it, and a `tracking` message for each frame. */
export class TrackSource extends CanvasSource {
  private frame = 0;

  protected paint(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = SIMA_PALETTE.text;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const tracks = roadTracks(this.frame);
    ctx.fillStyle = SIMA_PALETTE.backgroundAlt;
    for (const { bbox } of tracks) ctx.fillRect(...bbox);
    this.send({ type: 'tracking', data: { tracks } });
    this.frame += 1;
  }
}
