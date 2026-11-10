import type { NeatOverlayLineStyle } from '@sima/neat-ui/video';

/*
 * What `neat-bev` draws, in the vehicle's own frame: meters, x forward and y to the left (nuScenes,
 * ROS REP 103), forward up on the screen. Angles are radians, counter-clockwise from x, so a value
 * computed from a calibration or a detector's yaw goes in unchanged.
 */

/**
 * An object seen around the vehicle, such as a detection or a track.
 *
 * It is a box centered on `x`, `y`: `length` long along its heading `yaw`, and `width` across it.
 * It is drawn as a rotated rectangle, filled and outlined in its label's color. A line runs from
 * its center to the middle of its front edge.
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
 * Points in one label's color, such as radar or lidar returns.
 *
 * `xy` holds x, y pairs in meters. So a large cloud stays one typed array, and nothing is allocated
 * to draw it.
 */
export interface NeatBevPoints {
  /** What picks the points' color, and what the summary counts them as. */
  readonly label: string;
  /** x, y pairs in meters: x forward, y left. */
  readonly xy: Float32Array;
}

/**
 * A polyline in one label's color, such as a planned path, a lane or a boundary.
 *
 * With `fill` it is a polygon, such as a road, a zone, or free space from a model. A polygon is an
 * area, filled as a grid is: a light tint over the surface that covers what lies under it, without
 * an outline.
 *
 * A label's polygons fill as one area, so a road network given as overlapping pieces shows no
 * darker joins. For an outline, give the same points again as a line without `fill`.
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
 * A grid of cells over a rectangle, such as a drivable area or an occupancy map.
 *
 * It is drawn in its label's color. Each cell's value, 0 to 255, scales the grid's opacity, and 0
 * leaves the cell clear.
 *
 * `cells` is row-major in screen order, so the array reads like the picture. Row 0 is the forward
 * edge (`x[1]`), and column 0 the left edge (`y[1]`).
 *
 * Give a new array for new cells. The grid is redrawn when its `cells` array changes, not when the
 * same array is written to.
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
 * What the app draws besides a frame, under the data (`background`) or over it (`foreground`).
 *
 * It holds lines, polygons and points, in their labels' colors. Its polygons are lines with `fill`,
 * and see-through here.
 *
 * It is drawn with the view's cached layers, so it is for what changes rarely: a map's lanes, a
 * camera's field of view, a zone around the vehicle. Give a new object when it changes.
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
 * The plot's shape: `'round'` or `'rect'`.
 *
 * `'round'` is the circle of the view's range around the vehicle, with rings, as a radar shows it.
 * `'rect'` is a rectangle (`bounds`) with a metric grid.
 */
export type NeatBevShape = 'round' | 'rect';

/**
 * A rectangle around the vehicle in meters, as `NeatBevGrid` sets one.
 *
 * `x` is its back and front edges, in meters forward. `y` is its right and left edges, in meters to
 * the left.
 */
export interface NeatBevBounds {
  readonly x: readonly [min: number, max: number];
  readonly y: readonly [min: number, max: number];
}

/**
 * What lies outside the shape: `'clip'` or `'visible'`.
 *
 * `'clip'` cuts the data and the guides at the shape's edge. `'visible'` draws both over the whole
 * box, the rings and grid lines running on to its edges.
 */
export type NeatBevOverflow = 'clip' | 'visible';

/**
 * Where the guides (rings or grid lines, spokes, sensors' edges, the outline) are drawn: `'over'`
 * the data or `'under'` it. Their labels and the vehicle's marker are always on top.
 */
export type NeatBevGuides = 'over' | 'under';
