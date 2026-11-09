/*
 * A label's style row, as the video overlays' class rows and the bird's-eye view's `styles` give
 * them: the row for the label, else the row labelled `default`. Kept with the class colours, which
 * the rows' colours override.
 */

/** What a style row has at least: the label it styles and its colour. */
export interface LabelledRow {
  readonly label: string;
  readonly color: string;
}

/** Rows by label, and their colours as overrides for `resolveColor`. */
export function classStyles<R extends LabelledRow>(
  rows: readonly R[],
): {
  styles: Readonly<Record<string, R>>;
  overrides: Readonly<Record<string, string>>;
} {
  // No prototype, so a producer's label such as "__proto__" or "constructor" finds no row.
  const styles: Record<string, R> = Object.create(null);
  const overrides: Record<string, string> = Object.create(null);
  for (const row of rows) {
    styles[row.label] = row;
    overrides[row.label] = row.color;
  }
  return { styles, overrides };
}

/** The row for `label`, or the `default` row. */
export function styleFor<R>(styles: Readonly<Record<string, R>>, label: unknown): R | undefined {
  return styles[String(label)] ?? styles['default'];
}
