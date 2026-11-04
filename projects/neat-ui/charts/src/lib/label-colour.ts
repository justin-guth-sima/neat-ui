import { seriesToken } from './line-token';

const PALETTE_SIZE = 8;

/**
 * The colour of a label that stands for a class, a state or a gesture, as CSS: the series colour at
 * the label's place in `labels` (`--neat-series-1` to `-8`, the palette starting again after
 * eight), `--muted-foreground` for a label in `quiet` (the "nothing here" class, which should not
 * compete with the others), and `--neat-chip-neutral` for a label in neither list. One function,
 * so the score bars and an app's timeline of the same labels cannot colour them differently.
 */
export function neatLabelColour(
  label: string,
  labels: readonly string[],
  quiet: readonly string[],
): string {
  if (quiet.includes(label)) return 'var(--muted-foreground)';
  const index = labels.indexOf(label);
  return index < 0 ? 'var(--neat-chip-neutral)' : seriesToken(index % PALETTE_SIZE);
}
