import { type BevPlot, metresText, onPlot } from './geometry';
import type { NeatBevObject } from './model';

/*
 * What the bird's-eye view says to a screen reader in place of its picture: how many objects of
 * each label lie on its plot ("18 car, 51 pedestrian, 1 bus within 60 m"; a rectangle names its
 * edges, "from 20 m behind to 80 m ahead, 30 m either side"). Labels are named as the app gives
 * them, in the order they first appear, so the words stay put while the counts change.
 */

/** How often the summary may change, at most, so a live view does not chatter. */
export const SUMMARY_MS = 1000;

/** The summary of `objects` on `plot`. */
export function summaryText(objects: readonly NeatBevObject[] | undefined, plot: BevPlot): string {
  const counts = new Map<string, number>();
  for (const object of objects ?? []) {
    if (!onPlot(plot, object.x, object.y)) continue;
    counts.set(object.label, (counts.get(object.label) ?? 0) + 1);
  }
  const where = plotText(plot);
  if (counts.size === 0) return `Nothing ${where}`;
  const parts = [...counts].map(([label, count]) => `${count} ${label}`);
  return `${parts.join(', ')} ${where}`;
}

/** Where the plot reaches, in words: "within 60 m", or a rectangle's edges. */
function plotText(plot: BevPlot): string {
  const { back, front, right, left } = plot;
  if (plot.shape === 'round') return `within ${metresText(plot.range)}`;
  if (front === -back && left === -right && front === left) return `within ${metresText(front)}`;
  return `${span(back, front, 'behind', 'ahead')}, ${side(right, left)}`;
}

/** An extent along one axis: "from 20 m behind to 80 m ahead", "from 10 m to 80 m ahead". */
function span(low: number, high: number, below: string, above: string): string {
  const m = (value: number) => metresText(Math.abs(value));
  if (low < 0 && high > 0) return `from ${m(low)} ${below} to ${m(high)} ${above}`;
  if (low >= 0) return `from ${m(low)} to ${m(high)} ${above}`;
  return `from ${m(high)} to ${m(low)} ${below}`;
}

/** The extent across: "30 m either side", or as `span` has it. */
function side(right: number, left: number): string {
  if (right < 0 && left === -right) return `${metresText(left)} either side`;
  return span(right, left, 'right', 'left');
}
