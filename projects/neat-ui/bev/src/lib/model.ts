import type { NeatOverlayLineStyle } from '@sima/neat-ui/video';

/*
 * What `neat-bev` draws, in the vehicle's own frame: metres, x forward and y to the left (nuScenes,
 * ROS REP 103), forward up on the screen. Angles are radians, counter-clockwise from x, so a value
 * computed from a calibration or a detector's yaw goes in unchanged.
 */

/**
 * An object seen around the vehicle (a detection, a track): a box `length` long along its heading
 * `yaw` and `width` across it, centred on `x`, `y`. It is drawn as a rotated rectangle, filled
 * and outlined in its label's colour, with a line from its centre to the middle of its front edge.
 */
export interface NeatBevObject {
  /** Its centre, metres forward of the vehicle. */
  readonly x: number;
  /** Its centre, metres to the left of the vehicle. */
  readonly y: number;
  /** Metres along its heading. */
  readonly length: number;
  /** Metres across its heading. */
  readonly width: number;
  /** Its heading, radians counter-clockwise from the vehicle's forward axis. */
  readonly yaw: number;
  /** Its class ("car"): what picks its colour, and what the readout and the summary name. */
  readonly label: string;
  /** More for the readout, after the label and the distance (a score, a speed). */
  readonly text?: string;
}

/**
 * Points in one label's colour (radar or lidar returns): `xy` holds x, y pairs in metres, so a
 * large cloud stays one typed array and nothing is allocated to draw it.
 */
export interface NeatBevPoints {
  /** What picks the points' colour, and what the summary counts them as. */
  readonly label: string;
  /** x, y pairs in metres: x forward, y left. */
  readonly xy: Float32Array;
}

/** A polyline in one label's colour (a planned path, a lane, a boundary). */
export interface NeatBevLine {
  /** What picks its colour. */
  readonly label: string;
  /** x, y pairs in metres: x forward, y left. */
  readonly xy: Float32Array;
  /** Whether the last point joins the first. */
  readonly closed?: boolean;
  /** Its dash, as the video overlays' lines have it; a label's style row wins. Solid by default. */
  readonly style?: NeatOverlayLineStyle;
}

/**
 * A grid of cells over a rectangle (a drivable area, an occupancy map), drawn in its label's
 * colour: each cell's value, 0 to 255, scales the grid's opacity, 0 leaving the cell clear.
 * `cells` is row-major in screen order, so the array reads like the picture: row 0 is the forward
 * edge (`x[1]`), column 0 the left edge (`y[1]`). Give a new array for new cells: the grid is
 * redrawn when its `cells` array changes, not when the same array is written to.
 */
export interface NeatBevGrid {
  /** What picks its colour. */
  readonly label: string;
  /** `columns` × `rows` values, 0 to 255, row 0 forward and column 0 left. */
  readonly cells: Uint8Array;
  readonly columns: number;
  readonly rows: number;
  /** The rectangle's back and front edges, metres forward of the vehicle. */
  readonly x: readonly [min: number, max: number];
  /** The rectangle's right and left edges, metres to the left of the vehicle. */
  readonly y: readonly [min: number, max: number];
}

/** What `neat-bev` draws at one moment. Every part is optional. */
export interface NeatBevFrame {
  readonly objects?: readonly NeatBevObject[];
  readonly points?: readonly NeatBevPoints[];
  readonly lines?: readonly NeatBevLine[];
  readonly grids?: readonly NeatBevGrid[];
}

/**
 * What a sensor sees: a wedge from `origin` between the angles `from` and `to` (counter-clockwise
 * from `from`), out to `range`. Its edges are drawn as lines in its label's colour (and its arc
 * when it reaches less far than the view); `fill` also fills it faintly.
 */
export interface NeatBevSensor {
  /** What picks its colour (the camera's name, say). */
  readonly label: string;
  /** Its right edge, radians counter-clockwise from forward. */
  readonly from: number;
  /** Its left edge, radians counter-clockwise from forward. */
  readonly to: number;
  /** Where it is mounted, metres; the vehicle's centre by default. */
  readonly origin?: { readonly x: number; readonly y: number };
  /** How far it reaches, metres; the view's range by default. */
  readonly range?: number;
  /** Whether the wedge is also filled faintly in its label's colour; only its edges by default. */
  readonly fill?: boolean;
}

/**
 * A line out to the plot's edge: from `origin` (the vehicle's centre by default) at `angle`,
 * radians counter-clockwise from forward. A rig's seams between its cameras, or lines from where
 * its sensors are mounted.
 */
export interface NeatBevSpoke {
  readonly angle: number;
  readonly origin?: { readonly x: number; readonly y: number };
}

/**
 * The plot's shape: `'round'`, the circle of the view's range around the vehicle with rings, as a
 * radar shows it; `'rect'`, a rectangle (`bounds`) with a metric grid.
 */
export type NeatBevShape = 'round' | 'rect';

/**
 * A rectangle around the vehicle in metres, as `NeatBevGrid` sets one: `x` its back and front
 * edges (metres forward), `y` its right and left edges (metres to the left).
 */
export interface NeatBevBounds {
  readonly x: readonly [min: number, max: number];
  readonly y: readonly [min: number, max: number];
}

/**
 * What lies outside the shape: `'clip'` cuts the data and the guides at its edge; `'visible'`
 * draws both over the whole box, rings and grid lines running on to its edges.
 */
export type NeatBevOverflow = 'clip' | 'visible';

/**
 * Where the guides (rings or grid lines, spokes, sensors' edges, the outline) are drawn: `'over'`
 * the data or `'under'` it. Their labels and the vehicle's marker are always on top.
 */
export type NeatBevGuides = 'over' | 'under';
