/*
 * Colours of the video overlays: detections, masks, tracks, poses and ROI polygons. They are drawn
 * over live footage, not over the kit's surfaces, so they are chosen to stay apart on dark and
 * bright video rather than taken from the brand palette, and they are the same in both themes.
 */

/**
 * Identity colours, handed out by the overlay colour allocator in slot order. The first 20 are
 * hand-picked to stay apart on dark and bright video; the last 20 are overflow. Keep 40 entries;
 * overlay-palette.spec.ts checks their separation. Five per row keeps the slot numbers countable.
 */
// prettier-ignore
export const OVERLAY_PALETTE: readonly string[] = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#0891b2', '#ea580c', '#4f46e5', '#be123c', '#0f766e',
  '#f472b6', '#84cc16', '#fbbf24', '#38bdf8', '#92400e',
  '#d946ef', '#14532d', '#fdba74', '#f43f5e', '#5eead4',
  // Overflow colors, used only when a channel shows more than twenty identities at once.
  // They sit closer together than the first twenty, but still beat repeating a color.
  '#989900', '#ff96d3', '#e1a0fe', '#b6b4ff', '#e2684a',
  '#267d30', '#4d7800', '#e06285', '#78c7fd', '#786900',
  '#bc6ece', '#10d8d8', '#927eec', '#2bdda4', '#66da85',
  '#ab413e', '#5590f3', '#8fd465', '#1899ec', '#b1cc46',
];

/** The colour of an overlay with no identity: a track or pose without an id, a label-less class. */
export const OVERLAY_NEUTRAL_COLOR = '#f8fafc';

/** The dark plate behind track and pose labels, so the label reads in its identity colour. */
export const OVERLAY_LABEL_PLATE_COLOR = 'rgba(15, 23, 42, 0.82)';

/**
 * ROI polygons: a faint fill so the video stays visible, and a full-strength outline. A highlighted
 * polygon (the one under the pointer, or the app's pick) takes `fillActive`, the same hue three
 * times as strong: it stands out from its neighbours at a glance and the video still shows through.
 */
export const OVERLAY_ROI_COLORS = {
  inclusion: { fill: 'rgba(0,255,0,0.1)', fillActive: 'rgba(0,255,0,0.3)', stroke: 'green' },
  exclusion: { fill: 'rgba(255,0,0,0.1)', fillActive: 'rgba(255,0,0,0.3)', stroke: 'red' },
} as const;

/** The colour a class style row resolves to when its stored colour is missing or not a string. */
export const NEAT_OVERLAY_STYLE_FALLBACK_COLOR = '#00ff00';
