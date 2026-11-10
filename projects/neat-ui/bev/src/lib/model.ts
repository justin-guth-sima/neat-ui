import type { NeatOverlayLineStyle } from '@sima/neat-ui/video';

/*
 * What `neat-bev` draws, in the vehicle's own frame: meters, x forward and y to the left (nuScenes,
 * ROS REP 103), forward up on the screen. Angles are radians, counter-clockwise from x, so a value
 * computed from a calibration or a detector's yaw goes in unchanged.
 */

/**
 * An object seen around the vehicle (a detection, a track): a box `length` long along its heading
 * `yaw` and `width` across it, centered on `x`, `y`. It is drawn as a rotated rectangle, filled
 * and outlined in its label's color, with a line from its center to the middle of its front edge.
 */
export interface NeatBevObject {
  /**
   * What identifies it from frame to frame (a track's id), for `hovered` and `activated`. Give
   * every object an id, or none: without one an object is known by its index in `objects`.
   */
  readonly id?: NeatBevObjectId;
  /** Its center, meters forward of the vehicle. */
  readonly x: number;
  /** Its center, meters to the left of the vehicle. */
  readonly y: number;
  /** Meters along its heading. */
  readonly length: number;
  /** Meters across its heading. */
  readonly width: number;
  /** Its heading, radians counter-clockwise from the vehicle's forward axis. */
  readonly yaw: number;
  /** Its class ("car"): what picks its color, and what the readout and the summary name. */
  readonly label: string;
  /** More for the readout, after the label and the distance (a score, a speed). */
  readonly text?: string;
}

/** What identifies an object across frames: its `id`, or its index in `objects` without one. */
export type NeatBevObjectId = string | number;

/** A point around the vehicle, meters: x forward, y to the left. */
export interface NeatBevPoint {
  readonly x: number;
  readonly y: number;
}

/** A click or tap on the view (not a drag): what it hit, and where. */
export interface NeatBevPick extends NeatBevPoint {
  /** The object under it, or null for none. */
  readonly object: NeatBevObject | null;
  /** That object's id (its index without one), or null. */
  readonly id: NeatBevObjectId | null;
  /** The click itself, for its modifier keys. */
  readonly event: MouseEvent;
}

/**
 * Points in one label's color (radar or lidar returns): `xy` holds x, y pairs in meters, so a
 * large cloud stays one typed array and nothing is allocated to draw it.
 */
export interface NeatBevPoints {
  /** What picks the points' color, and what the summary counts them as. */
  readonly label: string;
  /** x, y pairs in meters: x forward, y left. */
  readonly xy: Float32Array;
}

/**
 * A polyline in one label's color (a planned path, a lane, a boundary), or with `fill` a polygon
 * (a road, a zone, free space from a model): an area, filled as a grid is, a light tint over the
 * surface that covers what lies under it, without an outline. A label's polygons fill as one area,
 * so a road network given as overlapping pieces shows no darker joins; for an outline, give the
 * same points again as a line without `fill`.
 */
export interface NeatBevLine {
  /** What picks its color. */
  readonly label: string;
  /** x, y pairs in meters: x forward, y left. */
  readonly xy: Float32Array;
  /** Whether the last point joins the first. */
  readonly closed?: boolean;
  /** Whether it is a polygon filled as an area, as a grid is, without an outline; it is closed. */
  readonly fill?: boolean;
  /** Its dash, as the video overlays' lines have it; a label's style row wins. Solid by default. */
  readonly style?: NeatOverlayLineStyle;
}

/**
 * A grid of cells over a rectangle (a drivable area, an occupancy map), drawn in its label's
 * color: each cell's value, 0 to 255, scales the grid's opacity, 0 leaving the cell clear.
 * `cells` is row-major in screen order, so the array reads like the picture: row 0 is the forward
 * edge (`x[1]`), column 0 the left edge (`y[1]`). Give a new array for new cells: the grid is
 * redrawn when its `cells` array changes, not when the same array is written to.
 */
export interface NeatBevGrid {
  /** What picks its color. */
  readonly label: string;
  /** `columns` × `rows` values, 0 to 255, row 0 forward and column 0 left. */
  readonly cells: Uint8Array;
  readonly columns: number;
  readonly rows: number;
  /** The rectangle's back and front edges, meters forward of the vehicle. */
  readonly x: readonly [min: number, max: number];
  /** The rectangle's right and left edges, meters to the left of the vehicle. */
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
 * What the app draws besides a frame, under the data (`background`) or over it (`foreground`):
 * lines, polygons (lines with `fill`, see-through here) and points, in their labels' colors.
 * Drawn with the view's cached layers, so for what changes rarely: a map's lanes, a camera's field
 * of view, a zone around the vehicle. Give a new object when it changes.
 */
export interface NeatBevLayer {
  readonly lines?: readonly NeatBevLine[];
  readonly points?: readonly NeatBevPoints[];
}

/**
 * A line out to the plot's edge: from `origin` (the vehicle's center by default) at `angle`,
 * radians counter-clockwise from forward.
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
 * A rectangle around the vehicle in meters, as `NeatBevGrid` sets one: `x` its back and front
 * edges (meters forward), `y` its right and left edges (meters to the left).
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
