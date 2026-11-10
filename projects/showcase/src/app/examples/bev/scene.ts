import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import type {
  NeatBevFrame,
  NeatBevGrid,
  NeatBevLine,
  NeatBevObject,
  NeatBevLayer,
} from '@sima/neat-ui/bev';

/*
 * A made-up street scene for the BEV examples, in the vehicle's frame (meters, x forward, y left):
 * the vehicle waits in the right lane of a road that crosses another 22 m ahead, with traffic,
 * people and a cyclist moving around it, a lidar's returns from the buildings, the lane markings,
 * a planned left turn and a six-camera rig. Nothing here comes from a real recording.
 */

/** The road the vehicle is on: its center line and half its width. */
const ROAD_Y = 1.75;
/** The crossing road: its center line, 22 m ahead. */
const CROSS_X = 22;
const HALF_ROAD = 7;
const LANE = 3.5;
/** How far the drivable grid reaches, and its cells: 128 × 128 at 0.8 m. */
const GRID_REACH = 51.2;
const GRID_CELLS = 128;
/** The buildings' walls at the four corners of the crossing, where the lidar sees them. */
const WALLS = {
  left: ROAD_Y + HALF_ROAD + 3.5,
  right: ROAD_Y - HALF_ROAD - 3.5,
  near: CROSS_X - HALF_ROAD - 3.5,
  far: CROSS_X + HALF_ROAD + 3.5,
} as const;
/** How far moving things travel before they wrap around. */
const WRAP = 56;

/** A deterministic random number generator, so the scene looks the same on every load. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function onRoad(x: number, y: number): boolean {
  return Math.abs(y - ROAD_Y) <= HALF_ROAD || Math.abs(x - CROSS_X) <= HALF_ROAD;
}

/** The drivable area: both roads, as a grid with row 0 forward and column 0 left. */
function drivableGrid(): NeatBevGrid {
  const size = (2 * GRID_REACH) / GRID_CELLS;
  const cells = new Uint8Array(GRID_CELLS * GRID_CELLS);
  for (let row = 0; row < GRID_CELLS; row++) {
    const x = GRID_REACH - (row + 0.5) * size;
    for (let column = 0; column < GRID_CELLS; column++) {
      const y = GRID_REACH - (column + 0.5) * size;
      if (onRoad(x, y)) cells[row * GRID_CELLS + column] = 255;
    }
  }
  return {
    label: 'drivable area',
    cells,
    columns: GRID_CELLS,
    rows: GRID_CELLS,
    x: [-GRID_REACH, GRID_REACH],
    y: [-GRID_REACH, GRID_REACH],
  };
}

/** x, y pairs from a list of points. */
const pairs = (points: readonly (readonly [number, number])[]): Float32Array =>
  Float32Array.from(points.flat());

/** The dashed center lines of both roads, broken where they cross. */
function laneMarkings(): NeatBevLine[] {
  const near = CROSS_X - HALF_ROAD;
  const far = CROSS_X + HALF_ROAD;
  const left = ROAD_Y + HALF_ROAD;
  const right = ROAD_Y - HALF_ROAD;
  return [
    [
      [-WRAP, ROAD_Y],
      [near, ROAD_Y],
    ],
    [
      [far, ROAD_Y],
      [WRAP, ROAD_Y],
    ],
    [
      [CROSS_X, -WRAP],
      [CROSS_X, right],
    ],
    [
      [CROSS_X, left],
      [CROSS_X, WRAP],
    ],
  ].map((points) => ({
    label: 'lane marking',
    xy: pairs(points as [number, number][]),
    style: 'dashed' as const,
  }));
}

/** The planned path: ahead to the crossing, a left turn into its far lane, and on. */
function plannedPath(): NeatBevLine {
  const radius = CROSS_X - LANE / 2 - 14;
  const points: [number, number][] = [
    [0, 0],
    [14, 0],
  ];
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    points.push([14 + radius * Math.sin(a), radius - radius * Math.cos(a)]);
  }
  points.push([CROSS_X - LANE / 2, 45]);
  return { label: 'planned path', xy: pairs(points) };
}

/** The lidar's returns from the buildings' walls at the four corners of the crossing. */
function wallReturns(next: () => number): Float32Array {
  const points: number[] = [];
  const walls = WALLS;
  const along = (fixed: 'x' | 'y', at: number, from: number, to: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const t = from + (to - from) * next();
      const depth = at + (next() - 0.5) * 0.4;
      points.push(fixed === 'x' ? depth : t, fixed === 'x' ? t : depth);
    }
  };
  along('y', walls.left, -45, walls.near, 900);
  along('y', walls.right, -45, walls.near, 900);
  along('y', walls.left, walls.far, 45, 500);
  along('y', walls.right, walls.far, 45, 500);
  along('x', walls.near, walls.left, 45, 500);
  along('x', walls.near, -45, walls.right, 500);
  along('x', walls.far, walls.left, 45, 400);
  along('x', walls.far, -45, walls.right, 400);
  return Float32Array.from(points);
}

/** Something that moves along a straight lane, wrapping around. */
interface Mover {
  /** Its track's id, as a tracker would give it: the label and a number ("car 3"). */
  readonly id: string;
  readonly label: string;
  readonly length: number;
  readonly width: number;
  /**
   * Where it starts, which way it faces (radians) and its speed in m/s, signed along x for a mover
   * heading along the road and along y for one heading across.
   */
  readonly x: number;
  readonly y: number;
  readonly yaw: number;
  readonly speed: number;
  readonly score: number;
}

const wrap = (value: number): number =>
  ((((value + WRAP) % (2 * WRAP)) + 2 * WRAP) % (2 * WRAP)) - WRAP;

function movers(next: () => number): Mover[] {
  const car = (x: number, y: number, yaw: number, speed: number): Omit<Mover, 'id'> => ({
    label: 'car',
    length: 4.5,
    width: 1.9,
    x,
    y,
    yaw,
    speed,
    score: 0.6 + 0.39 * next(),
  });
  const oncoming = ROAD_Y + LANE;
  const crossLeft = CROSS_X - LANE / 2;
  const crossRight = CROSS_X + LANE / 2;
  const list: Omit<Mover, 'id'>[] = [
    // Queued in the vehicle's lane, ahead and behind: waiting, as it is.
    car(9, 0, 0, 0),
    car(-9.5, 0, 0, 0),
    car(-17, 0.2, 0.02, 0),
    // Oncoming.
    ...[-40, -15, 12, 38].map((x) => car(x, oncoming, Math.PI, -9)),
    // Crossing, both ways.
    ...[-44, -20, 18, 41].map((y) => car(crossRight, y, -Math.PI / 2, -7)),
    ...[-35, -8, 30].map((y) => car(crossLeft, y, Math.PI / 2, 7)),
    {
      label: 'truck',
      length: 9,
      width: 2.5,
      x: crossRight,
      y: 5,
      yaw: -Math.PI / 2,
      speed: -7,
      score: 0.82,
    },
    {
      label: 'bicycle',
      length: 1.8,
      width: 0.6,
      x: -30,
      y: ROAD_Y - HALF_ROAD + 0.8,
      yaw: 0,
      speed: 4.5,
      score: 0.74,
    },
  ];
  // People on the pavements, and a group crossing the far side of the junction.
  const pavements = [ROAD_Y + HALF_ROAD + 1.5, ROAD_Y - HALF_ROAD - 1.5];
  for (let i = 0; i < 18; i++) {
    const side = pavements[i % 2];
    const forward = next() < 0.5;
    list.push({
      label: 'pedestrian',
      length: 0.6,
      width: 0.6,
      x: -50 + 100 * next(),
      y: side + (next() - 0.5),
      yaw: forward ? 0 : Math.PI,
      speed: (forward ? 1 : -1) * (0.9 + 0.6 * next()),
      score: 0.4 + 0.5 * next(),
    });
  }
  for (let i = 0; i < 5; i++) {
    list.push({
      label: 'pedestrian',
      length: 0.6,
      width: 0.6,
      x: CROSS_X + HALF_ROAD + 1 + next() * 1.5,
      y: -12 + 3 * next(),
      yaw: Math.PI / 2,
      speed: 1.2 + 0.3 * next(),
      score: 0.5 + 0.4 * next(),
    });
  }
  const counts = new Map<string, number>();
  return list.map((mover) => {
    const n = (counts.get(mover.label) ?? 0) + 1;
    counts.set(mover.label, n);
    return { ...mover, id: `${mover.label} ${n}` };
  });
}

/** The scene at `seconds`: everything moved on, the lidar's returns jittered a little. */
export class StreetScene {
  private readonly next = random(7);
  private readonly grid = drivableGrid();
  private readonly lanes = laneMarkings();
  private readonly path = plannedPath();
  private readonly walls = wallReturns(this.next);
  /** The returns as drawn: the walls, jittered in place each frame. */
  private readonly returns = new Float32Array(this.walls.length);
  private readonly movers = movers(this.next);

  frameAt(seconds: number): NeatBevFrame {
    for (let i = 0; i < this.walls.length; i++) {
      this.returns[i] = this.walls[i] + (this.next() - 0.5) * 0.15;
    }
    // A mover's speed is signed along its axis: x for those heading along the road, y across.
    const objects: NeatBevObject[] = this.movers.map((m) => {
      const traveled = m.speed * seconds;
      const along = Math.abs(Math.cos(m.yaw)) > 0.5;
      return {
        id: m.id,
        label: m.label,
        length: m.length,
        width: m.width,
        yaw: m.yaw,
        x: along ? wrap(m.x + traveled) : m.x,
        y: along ? m.y : wrap(m.y + traveled),
        text: `Score ${m.score.toFixed(2)}`,
      };
    });
    return {
      grids: [this.grid],
      lines: [...this.lanes, this.path],
      points: [{ label: 'lidar', xy: this.returns }],
      objects,
    };
  }
}

/**
 * The scene, moving on at 20 frames a second while the example is shown. Call in an injection
 * context.
 */
export function streetFrames(): Signal<NeatBevFrame> {
  const scene = new StreetScene();
  const started = performance.now();
  const frame = signal(scene.frameAt(0));
  const timer = setInterval(
    () => frame.set(scene.frameAt((performance.now() - started) / 1000)),
    50,
  );
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  return frame.asReadonly();
}

/** A rectangle, meters: back and front, right and left. */
const block = (back: number, front: number, right: number, left: number): Float32Array =>
  pairs([
    [back, right],
    [front, right],
    [front, left],
    [back, left],
  ]);

/**
 * What a map knows of the street, which does not move: the buildings' footprints, as polygons
 * for a view's `background`.
 */
export const BUILDINGS: NeatBevLayer = {
  lines: [
    block(-50, WALLS.near, WALLS.left, 30),
    block(-50, WALLS.near, -30, WALLS.right),
    block(WALLS.far, 60, WALLS.left, 30),
    block(WALLS.far, 60, -30, WALLS.right),
  ].map((xy) => ({ label: 'building', fill: true, xy })),
};

/** A zone the vehicle keeps clear ahead of it, dashed, for a view's `foreground`. */
export const SAFETY_ZONE: NeatBevLayer = {
  lines: [
    {
      label: 'safety zone',
      closed: true,
      style: 'dashed',
      xy: block(-1.5, 7, -1.6, 1.6),
    },
  ],
};
