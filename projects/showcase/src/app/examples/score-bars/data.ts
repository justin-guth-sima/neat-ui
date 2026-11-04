import type { NeatScore } from '@sima/neat-ui/charts';

/** IPN Hand's 14 classes; the first is the quiet one. */
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

/**
 * The scores at a step of the demo: one class takes most of the weight, a different one each
 * step, the rest share what is left. Softmax-like, so they add up to 1.
 */
export function scoresAt(step: number): readonly NeatScore[] {
  const winner = (step * 5) % CLASSES.length;
  const weights = CLASSES.map((_, index) =>
    index === winner ? 12 : 1 + ((index * 7 + step * 3) % 5) / 2,
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return CLASSES.map((label, index) => ({ label, value: weights[index] / total }));
}
