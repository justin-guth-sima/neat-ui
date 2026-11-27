/**
 * Where the word cloud floats, as a box in CSS pixels. Its words orbit inside it, and the box as a
 * whole stays inside the reply, 30 px from its sides.
 */
export interface NeatCloudBox {
  /**
   * The box's width, or `'full'` for the reply's whole width, which also keeps it from moving
   * sideways as text arrives. A number wider than the reply is cut to the reply's width.
   */
  readonly width: number | 'full';
  /** The box's height. The room kept below the reply's text grows to hold it. */
  readonly height: number;
  /**
   * How far the box's center lies right of where the newest piece starts; ignored with
   * `width: 'full'`. Negative goes left.
   */
  readonly x: number;
  /** How far the box's center lies below the bottom of the newest piece's line. */
  readonly y: number;
}

/** The word cloud's box when an app gives none: a band of 240 by 64 px under the newest piece. */
export const NEAT_CLOUD_BOX: NeatCloudBox = { width: 240, height: 64, x: 30, y: 26 };
