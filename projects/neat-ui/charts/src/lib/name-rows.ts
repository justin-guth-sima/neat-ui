/*
 * Where the label timeline draws its runs' names: above the strip, in rows. Pure, so the layout is
 * tested without a browser; the timeline measures the names and the strip and draws what it
 * returns.
 */

/** A name to place: its run's key, where its run starts across the strip and its width, in px. */
export interface NameBox {
  readonly key: string;
  readonly left: number;
  /** The name as drawn and the gap a row keeps after it. */
  readonly width: number;
}

/** A placed name: where it starts across the strip, in px, and its row, 0 next to the strip. */
export interface PlacedName {
  readonly key: string;
  readonly x: number;
  readonly row: number;
}

/**
 * The names in `rows` rows over a strip `stripWidth` px wide, by key. `boxes` come newest first and
 * are placed in that order, so the newest names win the room. A name starts at its run's start,
 * held back from the strip's right end (to its left end when it is wider than the strip), and may
 * be wider than its run. It goes into the row it had in `previous` while it still fits there, so
 * names that scroll with the strip do not jump between rows, else into the first row with room. A
 * name hangs from a rule down to the strip, so it takes its place in its own row and the rule's in
 * every row below. A name that fits in no row is left out.
 */
export function placeNames(
  boxes: readonly NameBox[],
  stripWidth: number,
  rows: number,
  previous: ReadonlyMap<string, number> = new Map(),
): Map<string, PlacedName> {
  const placed = new Map<string, PlacedName>();
  if (!(stripWidth > 0) || rows < 1) return placed;
  // The leftmost place taken in each row. Newer names lie to the right, so all right of it is taken.
  const taken = Array.from({ length: rows }, () => Infinity);
  for (const { key, left, width } of boxes) {
    const x = Math.max(0, Math.min(left, stripWidth - width));
    const fits = (row: number) => x + width <= taken[row];
    const kept = previous.get(key);
    const row =
      kept !== undefined && kept < rows && fits(kept)
        ? kept
        : taken.findIndex((_, index) => fits(index));
    if (row < 0) continue;
    for (let below = 0; below <= row; below++) taken[below] = Math.min(taken[below], x);
    placed.set(key, { key, x, row });
  }
  return placed;
}
