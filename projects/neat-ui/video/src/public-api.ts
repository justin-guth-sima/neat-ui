/*
 * Public API surface of @sima/neat-ui/video: the video tile, the tile grid and what they need, and
 * the region-of-interest editor, its swatch and `neatRoiNames`, which sit in the tile. A
 * secondary entry point, so a page that shows no video does not load it. It imports the primary
 * entry point (`@sima/neat-ui`); the primary never imports it. Every export added here is a
 * promise to consumers.
 */
export type { NeatMetadataMessage } from './lib/sync/metadata-message';
export type { NeatMetadataQueueStats, NeatMetadataSnapshot } from './lib/sync/metadata-sync';
export type {
  NeatGlobalBufferAction,
  NeatLateNoticeBlocker,
  NeatLateNoticeDetails,
  NeatLatenessSnapshot,
} from './lib/sync/metadata-lateness';
export { bufferSettleMs, lateNoticeDetails, nextWarningActive } from './lib/sync/metadata-lateness';
export { NEAT_OVERLAY_STYLE_FALLBACK_COLOR } from './lib/theme/overlay-palette';
export type {
  NeatOverlayClassStyle,
  NeatOverlayLineStyle,
  NeatOverlaySettings,
  NeatRoiPolygon,
} from './lib/overlays/overlay-settings';
export { NEAT_OVERLAY_DEFAULTS } from './lib/overlays/overlay-settings';
export type { NeatTileArea, NeatTilePack } from './lib/grid/pack';
export { fitAllTileWidth, NEAT_MIN_TILE_WIDTH } from './lib/grid/pack';
export type { NeatTileLayout } from './lib/grid/tile-grid';
export { NeatTileGrid } from './lib/grid/tile-grid';
export type { NeatRoiDrawMode } from './lib/roi-editor/roi-editor';
export { NeatRoiEditor } from './lib/roi-editor/roi-editor';
export { neatRoiNames } from './lib/roi-editor/roi-names';
export { NeatRoiSwatch } from './lib/roi-editor/roi-swatch';
export type { NeatTileSource } from './lib/tile/tile-source';
export type {
  NeatFrameStats,
  NeatTileFrame,
  NeatTileFrameListener,
  NeatTileState,
  NeatVideoBox,
} from './lib/tile/video-tile';
export { NeatVideoTile } from './lib/tile/video-tile';
