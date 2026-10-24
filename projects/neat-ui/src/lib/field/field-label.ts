/*
 * A form control's visible name over it, as `neat-field` and `neat-select` (with `showLabel`) both
 * draw it: one definition, so that fields side by side line up. With the same text size (hence
 * line height) for the name and the same gap under it, controls of one size in a row aligned at
 * their bottom edge have their names on one baseline. Class strings stay literals: Tailwind finds
 * the classes the kit stylesheet needs by reading them.
 */
export const FIELD_LABEL_CLASSES = {
  /** The column that holds the name and, under it, the control. */
  stack: 'flex flex-col gap-2',
  /** The name. */
  label: 'text-sm font-medium',
} as const;
