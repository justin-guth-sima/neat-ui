import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import type { NeatBevFrame, NeatBevLine, NeatBevObject } from '@sima/neat-ui/bev';

/*
 * A made-up road network for the polygon example, in the vehicle's frame (metres, x forward,
 * y left), given as pieces of drivable area the way a map gives them: polygons that overlap where
 * roads meet and fill as one area. The vehicle drives in the right lane of a wide four-lane road.
 * Behind it a narrow side road joins from the left with rounded corners; ahead a narrow road
 * crosses with straight corners; past the crossing a ramp branches off to the right in a curve,
 * which the planned path takes. Traffic moves on every road. Nothing here comes from a real
 * recording.
 */

/** The main road: four lanes, the vehicle in the rightmost, from far behind to far ahead. */
const LANE = 3.5;
const MAIN_RIGHT = -LANE / 2;
const MAIN_LEFT = MAIN_RIGHT + 4 * LANE;
const MAIN_FROM = -70;
const MAIN_TO = 80;
/** The narrow roads: two lanes of 3 m. */
const NARROW = 3;
/** The crossing road's centre line, ahead, and how far it reaches either side. */
const CROSS_X = 22;
const CROSS_REACH = 70;
/** The side road's centre line, behind, its rounded corners' radius and how far it reaches. */
const SIDE_X = -25;
const CORNER = 6;
const SIDE_REACH = 70;
/** The ramp: where it leaves the main road, how sharply it turns right, and its straight after. */
const RAMP_AT = 32;
const RAMP_RADIUS = 18;
const RAMP_EXIT = 50;
/** How finely curves are drawn: metres between points. */
const STEP = 1.5;

/** x, y pairs from a list of points. */
const pairs = (points: readonly (readonly [number, number])[]): Float32Array =>
  Float32Array.from(points.flat());

/** A rectangle, metres: back and front, right and left. */
const box = (back: number, front: number, right: number, left: number): Float32Array =>
  pairs([
    [back, right],
    [front, right],
    [front, left],
    [back, left],
  ]);

/** A point on a route `s` metres along it, and its heading. */
interface Along {
  readonly x: number;
  readonly y: number;
  readonly yaw: number;
}

/** A route traffic and lines follow: its length and where it is `s` metres along. */
interface Route {
  readonly length: number;
  at(s: number): Along;
}

/** A straight route from `x`, `y` heading `yaw`. */
function straight(x: number, y: number, yaw: number, length: number): Route {
  return {
    length,
    at: (s) => ({ x: x + s * Math.cos(yaw), y: y + s * Math.sin(yaw), yaw }),
  };
}

/** The ramp's centre line: along the main road's right lane, a quarter turn right, then straight. */
const RAMP_BEND = (RAMP_RADIUS * Math.PI) / 2;
const ramp: Route = {
  length: RAMP_BEND + RAMP_EXIT,
  at(s) {
    if (s <= RAMP_BEND) {
      const a = s / RAMP_RADIUS;
      return {
        x: RAMP_AT + RAMP_RADIUS * Math.sin(a),
        y: -RAMP_RADIUS * (1 - Math.cos(a)),
        yaw: -a,
      };
    }
    return {
      x: RAMP_AT + RAMP_RADIUS,
      y: -RAMP_RADIUS - (s - RAMP_BEND),
      yaw: -Math.PI / 2,
    };
  },
};

/** The point `offset` metres to the left of `route` at `s`. */
function beside(route: Route, s: number, offset: number): [number, number] {
  const { x, y, yaw } = route.at(s);
  return [x - offset * Math.sin(yaw), y + offset * Math.cos(yaw)];
}

/** Every `STEP` metres along `route`, its end included. */
function stations(route: Route): number[] {
  const at: number[] = [];
  for (let s = 0; s < route.length; s += STEP) at.push(s);
  at.push(route.length);
  return at;
}

/** A road of `half` width either side of `route`'s centre: up its right edge, back down its left. */
function band(route: Route, half: number): Float32Array {
  const right = stations(route).map((s) => beside(route, s, -half));
  const left = stations(route)
    .reverse()
    .map((s) => beside(route, s, half));
  return pairs([...right, ...left]);
}

/**
 * A rounded corner where a road leaving at `x` meets the main road's left edge, on the side
 * `toward` (-1 behind it, +1 ahead of it): the square of `CORNER` metres there, less the quarter
 * circle that rounds it.
 */
function roundedCorner(x: number, toward: -1 | 1): Float32Array {
  const cx = x + toward * CORNER;
  const cy = MAIN_LEFT + CORNER;
  const points: [number, number][] = [
    [cx, MAIN_LEFT],
    [x, MAIN_LEFT],
    [x, cy],
  ];
  // The arc from the side road's edge back to the main road's, bulging towards the corner.
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    points.push([cx - toward * CORNER * Math.cos(a), cy - CORNER * Math.sin(a)]);
  }
  return pairs(points);
}

const area = (xy: Float32Array): NeatBevLine => ({ label: 'drivable area', fill: true, xy });

/** The drivable area, as pieces that overlap where the roads meet. */
function drivableArea(): NeatBevLine[] {
  const sideLeft = SIDE_X - NARROW;
  const sideRight = SIDE_X + NARROW;
  return [
    area(box(MAIN_FROM, MAIN_TO, MAIN_RIGHT, MAIN_LEFT)),
    area(box(CROSS_X - NARROW, CROSS_X + NARROW, -CROSS_REACH, CROSS_REACH)),
    area(box(sideLeft, sideRight, MAIN_LEFT - 1, SIDE_REACH)),
    area(roundedCorner(sideLeft, -1)),
    area(roundedCorner(sideRight, 1)),
    area(band(ramp, NARROW)),
  ];
}

/** The main road's dashed lane lines, broken where the crossing road crosses it. */
function laneMarkings(): NeatBevLine[] {
  const lines: NeatBevLine[] = [];
  for (let lane = 1; lane < 4; lane++) {
    const y = MAIN_RIGHT + lane * LANE;
    for (const [from, to] of [
      [MAIN_FROM, CROSS_X - NARROW],
      [CROSS_X + NARROW, MAIN_TO],
    ]) {
      lines.push({
        label: 'lane marking',
        style: 'dashed',
        xy: pairs([
          [from, y],
          [to, y],
        ]),
      });
    }
  }
  return lines;
}

/** The vehicle's planned path: on along its lane, through the crossing, and off by the ramp. */
function plannedPath(): NeatBevLine {
  const points: [number, number][] = [[0, 0]];
  for (const s of stations(ramp)) points.push(beside(ramp, s, 0));
  return { label: 'planned path', xy: pairs(points) };
}

/**
 * Each lane traffic follows, as a route with its lane offset applied: on the right of the road in
 * its direction, as the vehicle drives.
 */
const ROUTES = {
  ahead: straight(MAIN_FROM, 0, 0, MAIN_TO - MAIN_FROM),
  aheadLeft: straight(MAIN_FROM, LANE, 0, MAIN_TO - MAIN_FROM),
  oncoming: straight(MAIN_TO, 3 * LANE, Math.PI, MAIN_TO - MAIN_FROM),
  oncomingRight: straight(MAIN_TO, 2 * LANE, Math.PI, MAIN_TO - MAIN_FROM),
  crossingLeft: straight(CROSS_X + NARROW / 2, -CROSS_REACH, Math.PI / 2, 2 * CROSS_REACH),
  crossingRight: straight(CROSS_X - NARROW / 2, CROSS_REACH, -Math.PI / 2, 2 * CROSS_REACH),
  side: straight(SIDE_X - NARROW / 2, SIDE_REACH, -Math.PI / 2, SIDE_REACH - MAIN_LEFT),
  ramp,
} as const satisfies Record<string, Route>;

/** Traffic: its route, where along it it starts, and how fast it goes, m/s. */
const TRAFFIC: readonly {
  readonly route: keyof typeof ROUTES;
  readonly at: number;
  readonly speed: number;
  readonly label: string;
}[] = [
  { route: 'ahead', at: 95, speed: 8, label: 'car' },
  { route: 'aheadLeft', at: 40, speed: 11, label: 'car' },
  { route: 'aheadLeft', at: 120, speed: 10, label: 'truck' },
  { route: 'oncoming', at: 20, speed: 12, label: 'car' },
  { route: 'oncomingRight', at: 90, speed: 10, label: 'car' },
  { route: 'crossingLeft', at: 30, speed: 7, label: 'car' },
  { route: 'crossingRight', at: 80, speed: 6, label: 'bicycle' },
  { route: 'side', at: 10, speed: 5, label: 'car' },
  { route: 'ramp', at: 20, speed: 7, label: 'car' },
];

const SIZES: Readonly<Record<string, readonly [length: number, width: number]>> = {
  car: [4.5, 1.9],
  truck: [9, 2.5],
  bicycle: [1.8, 0.6],
};

/** The network at `seconds`: the roads and lines stay; the traffic moves along its routes. */
export class RoadScene {
  private readonly lines = [...drivableArea(), ...laneMarkings(), plannedPath()];

  frameAt(seconds: number): NeatBevFrame {
    const objects: NeatBevObject[] = TRAFFIC.map((mover) => {
      const route = ROUTES[mover.route];
      const s = (mover.at + mover.speed * seconds) % route.length;
      const { x, y, yaw } = route.at(s);
      const [length, width] = SIZES[mover.label];
      return { label: mover.label, x, y, yaw, length, width, text: `${mover.speed} m/s` };
    });
    return { lines: this.lines, objects };
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
