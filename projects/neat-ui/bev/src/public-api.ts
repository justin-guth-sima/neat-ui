/*
 * Public API surface of @sima/neat-ui/bev: a bird's-eye view around a vehicle, with what it sees
 * and what its sensors cover. A secondary entry point, so an app's main bundle carries it only if
 * a page it loads imports it. It imports the primary entry point, whose class colours the video
 * overlays draw with too, so a label has one colour in the view and in the tiles; from the video
 * entry it takes types only, so a page with a view and no tile loads none of the tile's code. No
 * entry imports it. Every export added here is a promise to consumers.
 */
export { NeatBev } from './lib/bev';
export type {
  NeatBevFrame,
  NeatBevGrid,
  NeatBevLine,
  NeatBevObject,
  NeatBevPoints,
  NeatBevSensor,
  NeatBevShape,
  NeatBevSpoke,
} from './lib/model';
