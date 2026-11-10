import { NEAT_DANGER_BASE, SIMA_PALETTE } from '@sima/neat-ui';

/*
 * Colors of the video overlays besides the identity colors: the label plate, ROI polygons and
 * the style rows' fallback. The identity colors (detections, masks, tracks, poses) live in the
 * primary entry's theme (`identity-palette.ts`), since the bird's-eye view colors its labels from
 * them too; they are re-exported here under their old names for the overlays' code. All are the
 * same in both themes.
 */
export {
  ɵOVERLAY_NEUTRAL_COLOR as OVERLAY_NEUTRAL_COLOR,
  ɵOVERLAY_PALETTE as OVERLAY_PALETTE,
} from '@sima/neat-ui';

/** The dark plate behind track and pose labels, so the label reads in its identity color. */
export const OVERLAY_LABEL_PLATE_COLOR = 'rgba(15, 23, 42, 0.82)';

/** `#rrggbb` with an alpha channel appended: the canvas and SVG both read 8-digit hex. */
function withAlphaHex(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

/**
 * ROI polygons, unlike the identity colors, use the kit's own green and danger red: the user
 * draws them, so they belong to the app's chrome rather than to the footage's labels. A faint fill
 * keeps the video visible under them and a full-strength 2px outline marks the edge; a highlighted
 * polygon (the one under the pointer, or the app's pick) takes `fillActive`, the same hue three
 * times as strong, so it stands out from its neighbors while the video still shows through.
 */
export const OVERLAY_ROI_COLORS = {
  inclusion: {
    fill: withAlphaHex(SIMA_PALETTE.green, 0.1),
    fillActive: withAlphaHex(SIMA_PALETTE.green, 0.3),
    stroke: SIMA_PALETTE.green,
  },
  exclusion: {
    fill: withAlphaHex(NEAT_DANGER_BASE, 0.1),
    fillActive: withAlphaHex(NEAT_DANGER_BASE, 0.3),
    stroke: NEAT_DANGER_BASE,
  },
} as const;

/** The color a class style row resolves to when its stored color is missing or not a string. */
export const NEAT_OVERLAY_STYLE_FALLBACK_COLOR = '#00ff00';
