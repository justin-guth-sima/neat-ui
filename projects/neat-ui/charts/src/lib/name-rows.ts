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

/** A placed name: where its text and its rule stand across the strip, in px, and its row. */
export interface PlacedName {
  readonly key: string;
  /** Where the text starts: the run's start, or less when held back from the strip's end. */
  readonly x: number;
  /** Where the rule from the name down to the strip stands: always the run's start. */
  readonly rule: number;
  /** 0 next to the strip. */
  readonly row: number;
}

/**
 * The names in `rows` rows over a strip `stripWidth` px wide, by key. `boxes` come newest first and
 * are placed in that order, so the newest names win the room. A name starts at its run's start,
 * held back from the strip's right end (to its left end when it is wider than the strip), and may
 * be wider than its run. It goes into the row it had in `previous` while it still fits there, so
 * names that scroll with the strip do not jump between rows, else into the first row with room. A
 * name hangs from a rule at its run's start down to the strip (held back, the text moves and the
 * rule does not, so it still points at its own run): it takes its text's place in its own row and
 * the rule's in every row below, and its rule may not cross a name below. A name that fits in no
 * row is left out.
 */
export function placeNames(
  boxes: readonly NameBox[],
  stripWidth: number,
  rows: number,
  previous: ReadonlyMap<string, number> = new Map(),
): Map<string, PlacedName> {
  const placed = new Map<string, PlacedName>();
  if (!(stripWidth > 0) || rows < 1) return placed;
  // The leftmost place taken in each row: newer names lie to the right, so all right of it is.
  const taken = Array.from({ length: rows }, () => Infinity);
  for (const { key, left, width } of boxes) {
    const x = Math.max(0, Math.min(left, stripWidth - width));
    const rule = Math.min(left, stripWidth);
    // The text fits its row, and the rule passes left of the text in every row below.
    const fits = (row: number) =>
      x + width <= taken[row] && taken.slice(0, row).every((lower) => rule < lower);
    const kept = previous.get(key);
    const row =
      kept !== undefined && kept < rows && fits(kept)
        ? kept
        : taken.findIndex((_, index) => fits(index));
    if (row < 0) continue;
    taken[row] = Math.min(taken[row], x);
    for (let below = 0; below < row; below++) taken[below] = Math.min(taken[below], rule);
    placed.set(key, { key, x, rule, row });
  }
  return placed;
}
