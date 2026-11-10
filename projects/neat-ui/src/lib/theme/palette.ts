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

/** Functional colors outside the palette, which has no red or amber but errors and warnings need them. */
export const NEAT_DANGER_BASE = '#C8372D';
/** Used unchanged as the warning fill (step 500 of its scale), with palette text color on it. */
export const NEAT_WARN_BASE = '#E9A23B';

/**
 * The hue of the highlight tone, which marks a distinct state that is none of the statuses.
 *
 * It is the palette purple's hue (291° in OKLCH) at about three times its chroma. The palette
 * purple itself is too pale to work from. A row tint of 10% of it on white is #FAFAFD, no tint at
 * all. And no step of its scale is a fill that white text reads on and that still looks purple.
 */
export const NEAT_HIGHLIGHT_BASE = '#9D93D6';

/**
 * Base of the series teal: the teal of Justin's colors mockup, a hue the palette lacks.
 *
 * Chart series need a fourth hue next to blue, purple and orange that is not a status color.
 * Green, amber and red stay free to mean status.
 */
export const NEAT_SERIES_TEAL_BASE = '#2A8C9A';

/**
 * The dark scheme's darkest surface, its page: a neutral near-black. The dark surfaces are grays
 * from here up (`buildNeutralSurfaceScale`) rather than steps towards the palette text, whose teal
 * made a whole dark page read green.
 */
export const NEAT_NEAR_BLACK = '#101010';
