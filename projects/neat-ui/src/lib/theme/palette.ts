/** The fixed SiMa.ai brand palette (identical to the Slides/PowerPoint theme). */
export const SIMA_PALETTE = {
  text: '#010F0E',
  background: '#F3F4F5',
  backgroundAlt: '#E8E9EB',
  white: '#FFFFFF',
  orange: '#D26728',
  purple: '#D1CEE6',
  blue: '#5998DD',
  mint: '#C0E8DB',
  green: '#2A9C4F',
  lime: '#A4CC2D',
} as const;

/** Base of the primary scale. Swapping it (for example to the palette blue) re-derives the whole primary ramp. */
export const NEAT_PRIMARY_BASE: string = SIMA_PALETTE.orange;

/** Functional colours outside the palette, which has no red or amber but errors and warnings need them. */
export const NEAT_DANGER_BASE = '#C8372D';
export const NEAT_WARN_BASE = '#B7791F';
