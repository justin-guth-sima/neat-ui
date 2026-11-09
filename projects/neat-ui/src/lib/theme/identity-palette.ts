/*
 * The identity colours of drawings over live footage: the video overlays' detections, masks,
 * tracks and poses, and the bird's-eye view's labels, which take the page's class colours too. They
 * are drawn over video and its kin, not over the kit's surfaces, so they are chosen to stay apart
 * on dark and bright footage rather than taken from the brand palette, and they are the same in
 * both themes. Not for apps: the overlay colour allocator hands them out.
 */

/**
 * Identity colours, handed out by the overlay colour allocator in slot order. The first 20 are
 * hand-picked to stay apart on dark and bright video; the last 20 are overflow. Keep 40 entries;
 * identity-palette.spec.ts checks their separation. Five per row keeps the slot numbers countable.
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
