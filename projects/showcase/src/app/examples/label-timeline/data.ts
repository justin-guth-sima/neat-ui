/**
 * IPN Hand's 14 classes; the first is the quiet one. The same list, in the same order, as the
 * score bars example's, so a label has the same color in both (its spec holds them equal): the
 * docs let an example import only files of its own topic folder, so the list is repeated here.
 */
export const CLASSES: readonly string[] = [
  'No gesture',
  'Pointing with one finger',
  'Pointing with two fingers',
  'Click with one finger',
  'Click with two fingers',
  'Throw up',
  'Throw down',
  'Throw left',
  'Throw right',
  'Open twice',
  'Double click with one finger',
  'Double click with two fingers',
  'Zoom in',
  'Zoom out',
];

export const NO_GESTURE = CLASSES[0];

/** How long the demo's classifier keeps one result, in milliseconds, at a step. */
export function durationAt(step: number): number {
  return 1500 + ((step * 7) % 5) * 1100;
}

/** The class at a step: a gesture, then "No gesture" between two gestures. */
export function classAt(step: number): string {
  return step % 2 === 0 ? NO_GESTURE : CLASSES[1 + (((step >> 1) * 3) % (CLASSES.length - 1))];
}
