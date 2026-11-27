/*
 * The look of a readout, the box that says what lies under the pointer: the charts' (their time,
 * stacked and label timeline charts and the heatmap) and the bird's-eye view's. One definition, so
 * that every readout in the kit reads the same: in the popover's surface (its colors, radius, shadow and `--border` outline),
 * small tabular text, its lines in a column. Where it stands is its owner's (beside a sample, beside
 * an object). Internal to the kit; the primary exports it `ɵ` for the entries. Class strings stay
 * literals: Tailwind finds the classes the kit stylesheet needs by reading them.
 */
export const READOUT_CLASSES = {
  /** The box, over what is drawn and never catching the pointer. */
  box: 'z-1 flex flex-col gap-0.5 p-(--neat-space-2) rounded-md bg-popover shadow-md ring-1 ring-border text-popover-foreground text-(length:--neat-text-xs) tabular-nums whitespace-nowrap pointer-events-none',
  /** A muted line: when the sample was taken, a column's head. */
  muted: 'text-muted-foreground',
  /** A line of its own, a swatch before its text where it has one. */
  row: 'inline-flex items-center gap-(--neat-space-2)',
} as const;
