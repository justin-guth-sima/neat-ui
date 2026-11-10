/** The kit's named easing curves: a progress `t` from 0 to 1 in, the eased share out. */
export type NeatEasingName = 'ease-in-out' | 'ease-out' | 'ease-in' | 'linear';

/**
 * A curve for `neatEased`: a catalog name, or a function.
 *
 * Prefer a name, so every app moves the same way. A function, from `t` to the eased share (0 at 0,
 * 1 at 1), is for the rare motion no name fits.
 */
export type NeatEasing = NeatEasingName | ((t: number) => number);

/** The catalog: cubic curves, so they differ in where they hurry and where they settle. */
export const NEAT_EASINGS: Readonly<Record<NeatEasingName, (t: number) => number>> = {
  'ease-in-out': (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  'ease-out': (t) => 1 - (1 - t) ** 3,
  'ease-in': (t) => t ** 3,
  linear: (t) => t,
};
