/**
 * Reading a component stylesheet in a spec, for the rules jsdom cannot check by layout. A spec
 * imports the sheet as text (`with { loader: 'text' }`) and asks for a rule by its exact selector.
 */
export function stylesheet(sheet: string) {
  /** The declarations of the sheet's rule with exactly this selector. */
  const rule = (selector: string): string =>
    new RegExp(`(?:^|\\n)${selector.replace(/[()[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(
      sheet,
    )?.[1] ?? '';

  /** The value a rule declares for a property (not a longhand of it: `color` is not `border-color`). */
  const declared = (selector: string, property: string): string | undefined =>
    new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(rule(selector))?.[1];

  return { rule, declared };
}

/**
 * A declaration that clips the box's overflow or makes it a stacking context. A readout can hang
 * below its plot: any of these on a box around it would clip it, or let the next card paint over it.
 */
export const CLIPS_OR_STACKS =
  /(?:^|[;\s])(?:overflow(?:-[xy])?|z-index|isolation|transform|opacity|filter|contain|will-change|mask|clip-path|perspective|backdrop-filter)\s*:/;
