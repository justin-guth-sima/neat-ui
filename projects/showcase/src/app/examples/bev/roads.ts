import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import type { NeatBevFrame, NeatBevLine, NeatBevObject } from '@sima/neat-ui/bev';

/*
 * A made-up road network for the polygon example, laid out in a world frame of its own (meters,
 * X east, Y north) and given as pieces of drivable area the way a map gives them: polygons that
 * overlap where roads meet and fill as one area. A wide four-lane ring road with rounded corners;
 * a narrow road straight through it, crossing it twice with square corners; a narrow side road
 * joining it from the east with rounded corners; and a ramp branching off it in a curve to the
 * south. The vehicle drives round the ring counterclockwise, and every frame the world is turned
 * into the vehicle's frame (x forward, y left), so the roads and the traffic move and turn
 * around it. Nothing here comes from a real recording.
 */

/** Lanes, and the roads' half widths: the ring's four lanes, the narrow roads' two of 3 m. */
const LANE = 3.5;
const RING_HALF = 2 * LANE;
const NARROW = 3;
/** The ring's center line: a rectangle 120 × 80 m with rounded corners. */
const RING_X = 60;
const RING_Y = 40;
const RING_CORNER = 18;
/** The road through the ring, north to south, and how far it reaches. */
const THROUGH_REACH = 80;
/** The side road, joining the ring's east side: its center line, its end and its corners' radius. */
const SIDE_Y = 10;
const SIDE_TO = 120;
const FILLET = 6;
/** The ramp: where it leaves the ring's south side, how sharply it turns, how far it runs on. */
const RAMP_FROM = 15;
const RAMP_RADIUS = 25;
const RAMP_ON = 60;
/** How finely curves and lines are drawn: meters between points. */
const STEP = 1.5;
/** The vehicle's speed round the ring, m/s, and how far ahead its planned path reaches. */
const VEHICLE_SPEED = 12;
const PLAN_AHEAD = 50;

/** Where something is and which way it heads (radians counterclockwise from east). */
interface Pose {
  readonly x: number;
  readonly y: number;
  readonly yaw: number;
}

/** A path things follow: its length, and where it is `s` meters along. */
interface Route {
  readonly length: number;
  at(s: number): Pose;
}

/** A straight run, or an arc turning left (positive) or right (negative) by `turn` radians. */
type Piece = { readonly straight: number } | { readonly radius: number; readonly turn: number };

/** Where `distance` meters along `piece` from `from` is. */
function along(from: Pose, piece: Piece, distance: number): Pose {
  if ('straight' in piece) {
    return {
      x: from.x + distance * Math.cos(from.yaw),
      y: from.y + distance * Math.sin(from.yaw),
      yaw: from.yaw,
    };
  }
  const side = Math.sign(piece.turn);
  // The arc's center lies `radius` to the left of the start (to the right for a right turn).
  const cx = from.x - side * piece.radius * Math.sin(from.yaw);
  const cy = from.y + side * piece.radius * Math.cos(from.yaw);
  const yaw = from.yaw + (side * distance) / piece.radius;
  return {
    x: cx + side * piece.radius * Math.sin(yaw),
    y: cy - side * piece.radius * Math.cos(yaw),
    yaw,
  };
}

/** A route from `start` along `pieces`, one after the other. */
function path(start: Pose, pieces: readonly Piece[]): Route {
  const starts: Pose[] = [];
  const lengths: number[] = [];
  let pose = start;
  for (const piece of pieces) {
    starts.push(pose);
    const length = 'straight' in piece ? piece.straight : piece.radius * Math.abs(piece.turn);
    lengths.push(length);
    pose = along(pose, piece, length);
  }
  const length = lengths.reduce((a, b) => a + b, 0);
  return {
    length,
    at(s) {
      let rest = Math.min(Math.max(s, 0), length);
      for (let i = 0; i < pieces.length - 1; i++) {
        if (rest <= lengths[i]) return along(starts[i], pieces[i], rest);
        rest -= lengths[i];
      }
      return along(starts[pieces.length - 1], pieces[pieces.length - 1], rest);
    },
  };
}

/** `route` moved `offset` meters to its left, and run the other way when `back`. */
function lane(route: Route, offset: number, back = false): Route {
  return {
    length: route.length,
    at(s) {
      const pose = route.at(back ? route.length - s : s);
      return {
        x: pose.x - offset * Math.sin(pose.yaw),
        y: pose.y + offset * Math.cos(pose.yaw),
        yaw: back ? pose.yaw + Math.PI : pose.yaw,
      };
    },
  };
}

/** The ring's center line, counterclockwise from the middle of its south side. */
const QUARTER = { radius: RING_CORNER, turn: Math.PI / 2 } as const;
const RING = path({ x: 0, y: -RING_Y, yaw: 0 }, [
  { straight: RING_X - RING_CORNER },
  QUARTER,
  { straight: 2 * (RING_Y - RING_CORNER) },
  QUARTER,
  { straight: 2 * (RING_X - RING_CORNER) },
  QUARTER,
  { straight: 2 * (RING_Y - RING_CORNER) },
  QUARTER,
  { straight: RING_X - RING_CORNER },
]);
const THROUGH = path({ x: 0, y: -THROUGH_REACH, yaw: Math.PI / 2 }, [
  { straight: 2 * THROUGH_REACH },
]);
const SIDE = path({ x: RING_X + RING_HALF, y: SIDE_Y, yaw: 0 }, [
  { straight: SIDE_TO - RING_X - RING_HALF },
]);
/** The ramp leaves the ring's outer eastbound lane and turns south. */
const RAMP = path({ x: RAMP_FROM, y: -RING_Y - 1.5 * LANE, yaw: 0 }, [
  { radius: RAMP_RADIUS, turn: -Math.PI / 2 },
  { straight: RAMP_ON },
]);

/** Every `STEP` meters along `route` from `from` to `to`, `to` included. */
function stations(route: Route, from = 0, to = route.length): number[] {
  const at: number[] = [];
  for (let s = from; s < to; s += STEP) at.push(s);
  at.push(to);
  return at;
}

/** The points of `route`, `offset` meters to its left. */
function trace(route: Route, offset = 0): [number, number][] {
  const side = lane(route, offset);
  return stations(route).map((s) => {
    const { x, y } = side.at(s);
    return [x, y];
  });
}

/** A road `half` wide either side of `route`: up its right edge and back down its left. */
const band = (route: Route, half: number): [number, number][] => [
  ...trace(route, -half),
  ...trace(route, half).reverse(),
];

/** A rectangle, meters: west and east, south and north. */
const box = (west: number, east: number, south: number, north: number): [number, number][] => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
];

/**
 * A rounded corner where a road meets another's edge at `corner`: the square `FILLET` meters
 * along the edge (`edge`, a unit direction away from the road) and along the road (`road`), less
 * the quarter circle that rounds it.
 */
function fillet(
  corner: readonly [number, number],
  edge: readonly [number, number],
  road: readonly [number, number],
): [number, number][] {
  const [px, py] = corner;
  const cx = px + FILLET * (edge[0] + road[0]);
  const cy = py + FILLET * (edge[1] + road[1]);
  const points: [number, number][] = [
    [px + FILLET * edge[0], py + FILLET * edge[1]],
    [px, py],
    [px + FILLET * road[0], py + FILLET * road[1]],
  ];
  // Round from the road's edge back to the other edge, bulging towards the corner.
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    points.push([
      cx - FILLET * (Math.cos(a) * edge[0] + Math.sin(a) * road[0]),
      cy - FILLET * (Math.cos(a) * edge[1] + Math.sin(a) * road[1]),
    ]);
  }
  return points;
}

/** A line in the world, and the line the view draws: its points in the vehicle's frame. */
interface Placed {
  readonly world: Float32Array;
  readonly line: NeatBevLine;
}

function placed(
  points: readonly (readonly [number, number])[],
  line: Omit<NeatBevLine, 'xy'>,
): Placed {
  const world = Float32Array.from(points.flat());
  return { world, line: { ...line, xy: new Float32Array(world.length) } };
}

/** The drivable area, as pieces that overlap where the roads meet. */
function drivableArea(): Placed[] {
  const edge = RING_X + RING_HALF;
  const area = { label: 'drivable area', fill: true } as const;
  return [
    band(RING, RING_HALF),
    box(-NARROW, NARROW, -THROUGH_REACH, THROUGH_REACH),
    box(edge - 1, SIDE_TO, SIDE_Y - NARROW, SIDE_Y + NARROW),
    fillet([edge, SIDE_Y + NARROW], [0, 1], [1, 0]),
    fillet([edge, SIDE_Y - NARROW], [0, -1], [1, 0]),
    band(RAMP, NARROW),
  ].map((points) => placed(points, area));
}

/** The lane lines: the ring's, the through road's (broken where it crosses) and the side road's. */
function laneMarkings(): Placed[] {
  const dashed = { label: 'lane marking', style: 'dashed' } as const;
  const outside = RING_Y + RING_HALF;
  const inside = RING_Y - RING_HALF;
  return [
    placed(trace(RING, -LANE), { ...dashed, closed: true }),
    placed(trace(RING, LANE), { ...dashed, closed: true }),
    placed(trace(RING), { label: 'lane marking', style: 'solid', closed: true }),
    ...[
      [-THROUGH_REACH, -outside],
      [-inside, inside],
      [outside, THROUGH_REACH],
    ].map(([from, to]) =>
      placed(
        [
          [0, from],
          [0, to],
        ],
        dashed,
      ),
    ),
    placed(
      [
        [RING_X + RING_HALF, SIDE_Y],
        [SIDE_TO, SIDE_Y],
      ],
      dashed,
    ),
  ];
}

/** The lanes traffic follows, on the right of each road in its direction. */
const ROUTES = {
  ring: lane(RING, -LANE / 2),
  ringOuter: lane(RING, -1.5 * LANE),
  ringBack: lane(RING, LANE / 2, true),
  ringBackOuter: lane(RING, 1.5 * LANE, true),
  north: lane(THROUGH, -NARROW / 2),
  south: lane(THROUGH, NARROW / 2, true),
  side: lane(SIDE, NARROW / 2, true),
  ramp: RAMP,
} as const satisfies Record<string, Route>;

/** Traffic: its track's id, its route, where along it it starts, its speed (m/s) and label. */
const TRAFFIC: readonly {
  readonly id: string;
  readonly route: keyof typeof ROUTES;
  readonly at: number;
  readonly speed: number;
  readonly label: string;
}[] = [
  { id: 'car 1', route: 'ring', at: 40, speed: VEHICLE_SPEED, label: 'car' },
  { id: 'car 2', route: 'ring', at: 250, speed: VEHICLE_SPEED, label: 'car' },
  { id: 'truck 1', route: 'ringOuter', at: 60, speed: 8, label: 'truck' },
  { id: 'car 3', route: 'ringOuter', at: 200, speed: 9, label: 'car' },
  { id: 'car 4', route: 'ringBack', at: 30, speed: 11, label: 'car' },
  { id: 'car 5', route: 'ringBack', at: 180, speed: 11, label: 'car' },
  { id: 'car 6', route: 'ringBackOuter', at: 120, speed: 9, label: 'car' },
  { id: 'car 7', route: 'north', at: 20, speed: 8, label: 'car' },
  { id: 'bicycle 1', route: 'south', at: 60, speed: 5, label: 'bicycle' },
  { id: 'car 8', route: 'side', at: 10, speed: 7, label: 'car' },
  { id: 'car 9', route: 'ramp', at: 30, speed: 9, label: 'car' },
];

const SIZES: Readonly<Record<string, readonly [length: number, width: number]>> = {
  car: [4.5, 1.9],
  truck: [9, 2.5],
  bicycle: [1.8, 0.6],
};

/** The vehicle's own lane round the ring, and the length of its lap. */
const OWN_LANE = ROUTES.ring;
export const LAP = OWN_LANE.length;
/** How many points the planned path has. */
const PLAN_POINTS = stations(OWN_LANE, 0, PLAN_AHEAD).length;

/** The network as the vehicle sees it `seconds` into its laps. */
export class RoadScene {
  private readonly placed = [...drivableArea(), ...laneMarkings()];
  private readonly plan = new Float32Array(2 * PLAN_POINTS);
  private readonly path: NeatBevLine = {
    label: 'planned path',
    xy: new Float32Array(2 * PLAN_POINTS),
  };

  frameAt(seconds: number): NeatBevFrame {
    const traveled = (VEHICLE_SPEED * seconds) % LAP;
    const vehicle = OWN_LANE.at(traveled);
    const cos = Math.cos(vehicle.yaw);
    const sin = Math.sin(vehicle.yaw);
    // World to vehicle: about the vehicle, turned so that its heading is forward.
    const into = (world: Float32Array, out: Float32Array) => {
      for (let i = 0; i + 1 < world.length; i += 2) {
        const dx = world[i] - vehicle.x;
        const dy = world[i + 1] - vehicle.y;
        out[i] = dx * cos + dy * sin;
        out[i + 1] = -dx * sin + dy * cos;
      }
    };
    for (const { world, line } of this.placed) into(world, line.xy);

    stations(OWN_LANE, 0, PLAN_AHEAD).forEach((d, i) => {
      const { x, y } = OWN_LANE.at((traveled + d) % LAP);
      this.plan[2 * i] = x;
      this.plan[2 * i + 1] = y;
    });
    into(this.plan, this.path.xy);

    const objects: NeatBevObject[] = TRAFFIC.map((mover) => {
      const route = ROUTES[mover.route];
      const pose = route.at((mover.at + mover.speed * seconds) % route.length);
      const [length, width] = SIZES[mover.label];
      const dx = pose.x - vehicle.x;
      const dy = pose.y - vehicle.y;
      return {
        id: mover.id,
        label: mover.label,
        x: dx * cos + dy * sin,
        y: -dx * sin + dy * cos,
        yaw: pose.yaw - vehicle.yaw,
        length,
        width,
        text: `${mover.speed} m/s`,
      };
    });
    return { lines: [...this.placed.map(({ line }) => line), this.path], objects };
  }
}

/** The network, moving on at 20 frames a second while the example is shown. */
export function roadFrames(): Signal<NeatBevFrame> {
  const scene = new RoadScene();
  const started = performance.now();
  const frame = signal(scene.frameAt(0));
  const timer = setInterval(
    () => frame.set(scene.frameAt((performance.now() - started) / 1000)),
    50,
  );
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  return frame.asReadonly();
}
