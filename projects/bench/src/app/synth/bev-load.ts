import type { NeatBevFrame, NeatBevLine, NeatBevObject } from '@sima/neat-ui/bev';
import { mulberry32, type Prng } from './prng';

/*
 * The bird's-eye view's measured load (the bev spec's budget): 100 objects moving through the
 * view, a lidar's 30,000 returns redrawn every frame, 4 lines and one 128 × 128 grid, at 20 frames
 * a second. Seeded, so every run draws the same thing. The points are rewritten in place, as a
 * driver's buffer would be, and the grid stays one array, as a map that has not changed does: the
 * view draws them as an app would hand them over.
 */

/** How big a load is: the budget's by default, smaller or larger to find where a cost lies. */
export interface BevLoadSize {
  readonly objects: number;
  readonly points: number;
}

export const BEV_LOAD = {
  objects: 100,
  points: 30_000,
  lines: 4,
  gridCells: 128,
  /** Frames a second the load is fed at. */
  hz: 20,
  /** Metres the view reaches. */
  range: 60,
} as const;

const LABELS = ['car', 'truck', 'pedestrian', 'bicycle', 'bus'] as const;
const GRID_REACH = 51.2;

interface Mover {
  readonly object: Omit<NeatBevObject, 'x' | 'y'>;
  readonly x: number;
  readonly y: number;
  /** m/s along its heading. */
  readonly speed: number;
}

/** A value wrapped into ±`reach`, so movers leave one side and come back on the other. */
const wrap = (value: number, reach: number): number =>
  ((((value + reach) % (2 * reach)) + 2 * reach) % (2 * reach)) - reach;

export class BevLoad {
  private readonly rand: Prng;
  private readonly movers: Mover[];
  private readonly lines: NeatBevLine[];
  private readonly grid: NonNullable<NeatBevFrame['grids']>[number];
  /** Each return's angle and distance, fixed; jittered into `xy` each frame. */
  private readonly polar: Float32Array;
  private readonly xy: Float32Array;

  private readonly points: number;

  constructor(seed = 1, size: BevLoadSize = BEV_LOAD) {
    this.rand = mulberry32(seed);
    this.points = size.points;
    const rand = this.rand;
    const { range } = BEV_LOAD;
    this.movers = Array.from({ length: size.objects }, (_, i) => {
      const label = LABELS[i % LABELS.length];
      const big = label === 'truck' || label === 'bus';
      const small = label === 'pedestrian' || label === 'bicycle';
      return {
        object: {
          label,
          length: big ? 9 : small ? 0.8 : 4.5,
          width: big ? 2.5 : small ? 0.6 : 1.9,
          yaw: rand() * 2 * Math.PI,
          text: `Score ${(0.4 + 0.6 * rand()).toFixed(2)}`,
        },
        x: (rand() * 2 - 1) * range,
        y: (rand() * 2 - 1) * range,
        speed: small ? 1.5 : 8,
      };
    });
    this.lines = Array.from({ length: BEV_LOAD.lines }, (_, i) => {
      const points: number[] = [];
      for (let t = 0; t <= 40; t++) {
        const s = (t / 40) * 2 * range - range;
        points.push(s, 3.5 * (i - 1.5) + 2 * Math.sin(s / 15 + i));
      }
      return { label: i === 0 ? 'planned path' : 'lane', xy: Float32Array.from(points) };
    });
    const n = BEV_LOAD.gridCells;
    const cells = new Uint8Array(n * n);
    for (let i = 0; i < cells.length; i++) cells[i] = rand() < 0.4 ? 255 : 0;
    this.grid = {
      label: 'drivable area',
      cells,
      columns: n,
      rows: n,
      x: [-GRID_REACH, GRID_REACH],
      y: [-GRID_REACH, GRID_REACH],
    };
    this.polar = new Float32Array(this.points * 2);
    for (let i = 0; i < this.points; i++) {
      this.polar[2 * i] = rand() * 2 * Math.PI;
      this.polar[2 * i + 1] = 2 + rand() * (range - 2);
    }
    this.xy = new Float32Array(this.points * 2);
  }

  /** What the view draws at `seconds`: a new frame object, the points rewritten in place. */
  frameAt(seconds: number): NeatBevFrame {
    const rand = this.rand;
    for (let i = 0; i < this.points; i++) {
      const angle = this.polar[2 * i];
      const distance = this.polar[2 * i + 1] + (rand() - 0.5) * 0.3;
      this.xy[2 * i] = distance * Math.cos(angle);
      this.xy[2 * i + 1] = distance * Math.sin(angle);
    }
    const { range } = BEV_LOAD;
    const objects = this.movers.map(({ object, x, y, speed }) => ({
      ...object,
      x: wrap(x + Math.cos(object.yaw) * speed * seconds, range),
      y: wrap(y + Math.sin(object.yaw) * speed * seconds, range),
    }));
    return {
      objects,
      points: [{ label: 'lidar', xy: this.xy }],
      lines: this.lines,
      grids: [this.grid],
    };
  }
}
