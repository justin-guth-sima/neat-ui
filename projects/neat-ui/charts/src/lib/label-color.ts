import { seriesToken } from './line-token';

const PALETTE_SIZE = 8;

/**
 * The color of a label that stands for a class, a state or a gesture, as CSS.
 *
 * ```ts
 * neatLabelColor('Palm', ['Fist', 'Palm'], ['No gesture']); // 'var(--neat-series-2)'
 * ```
 *
 * - A label in `quiet` takes `--muted-foreground`, even when `labels` has it too. It is the
 *   "nothing here" class, which should not compete with the others.
 * - A label in `labels` takes the series color at its place: `--neat-series-1` to `-8`, the
 *   palette starting again after eight.
 * - A label in neither list takes `--neat-chip-neutral`.
 *
 * It is one function, so the score bars and an app's timeline of the same labels cannot color
 * them differently.
 *
 * The one exception is the timeline's quiet runs. They fill a stretch of the strip, often most of
 * the window. So the timeline fills them with `--muted` instead, and the quiet class is never its
 * heaviest mark. The score bars' quiet fill stays `--muted-foreground`.
 */
export function neatLabelColor(
  label: string,
  labels: readonly string[],
  quiet: readonly string[],
): string {
  if (quiet.includes(label)) return 'var(--muted-foreground)';
  const index = labels.indexOf(label);
  return index < 0 ? 'var(--neat-chip-neutral)' : seriesToken(index % PALETTE_SIZE);
}

/**
 * The British spelling of `neatLabelColor`, kept so apps that import it keep working.
 *
 * @deprecated Use `neatLabelColor`; this name goes in a later release.
 */
export const neatLabelColour = neatLabelColor;
