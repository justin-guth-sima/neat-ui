/*
 * The rendering bench's window into this entry's internals (AGENTS.md "The rendering bench"), an
 * agreed exception to "only what an app needs is exported". The bench draws the same diagram with
 * ngx-vflow and puts this entry's own dot layer over it, so it needs what `neat-diagram` uses
 * inside: the level as drawn (the kit's routes, tips and colors), the notes' placement and the fit
 * (so vflow shows the same picture from the same start), the messaging layer's context token (so
 * the layer draws over another renderer), and its frame probe and dot cap (so the bench times the
 * layer and marks a capped step). Copies of these in the bench would measure different code.
 *
 * Not in `public-api.ts`, so ng-packagr never ships it (`npm run check:dist` proves it); the bench
 * reaches it through the `@bench/diagram-seam` alias in its own tsconfig, and ESLint fails an
 * import of it anywhere else. Everything here is internal and may change in any release.
 */
export { drawLevel, type DrawnEdge, type DrawnLevel } from './lib/drawing';
export { fitTransform, levelExtent, ZOOM_LIMITS } from './lib/fit';
export type { Rect } from './lib/layout';
export { type NotePlacement, placeNotes } from './lib/notes';
export {
  DIAGRAM_MESSAGES_CONTEXT,
  type DiagramMessagesContext,
  type DiagramTransform,
  DOT_FRAME_PROBE,
  type DotFrameProbe,
  type MessagesEdge,
  type MessagesLevel,
} from './lib/messages/context';
export { MAX_DOTS } from './lib/messages/dot-model';
