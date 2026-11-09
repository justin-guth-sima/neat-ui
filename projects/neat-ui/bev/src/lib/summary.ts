import { metresText } from './geometry';
import type { NeatBevObject } from './model';

/*
 * What the bird's-eye view says to a screen reader in place of its picture: how many objects of
 * each label lie within its range ("18 car, 51 pedestrian, 1 bus within 60 m"). Labels are named
 * as the app gives them, in the order they first appear, so the words stay put while the counts
 * change.
 */

/** How often the summary may change, at most, so a live view does not chatter. */
export const SUMMARY_MS = 1000;

/** The summary of `objects` for a view reaching `range` metres. */
export function summaryText(objects: readonly NeatBevObject[] | undefined, range: number): string {
  const counts = new Map<string, number>();
  for (const object of objects ?? []) {
    if (Math.hypot(object.x, object.y) > range) continue;
    counts.set(object.label, (counts.get(object.label) ?? 0) + 1);
  }
  const within = `within ${metresText(range)}`;
  if (counts.size === 0) return `Nothing ${within}`;
  const parts = [...counts].map(([label, count]) => `${count} ${label}`);
  return `${parts.join(', ')} ${within}`;
}
