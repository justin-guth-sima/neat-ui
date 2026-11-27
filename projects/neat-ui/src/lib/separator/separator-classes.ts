/**
 * The classes of Spartan's separator (helm's `hlmSeparatorClass`), copied verbatim in the parts a
 * kit divider takes or changes. Helm keeps them inline, in one string, so they are held here as
 * data: the drift spec reads the vendored file and fails when a part is no longer in it.
 *
 * The parts are what a divider mixes: its color (`color`, which the rail replaces with its own
 * token) and the line's thickness and reach for its orientation. Helm's variants read the host's
 * `data-horizontal` and `data-vertical` attributes, which brain's separator does not write (it
 * writes `data-orientation`), so each divider sets the one that names its orientation.
 */
export const SEPARATOR_CLASSES = {
  base: 'inline-flex shrink-0',
  color: 'bg-border',
  horizontalThickness: 'data-horizontal:h-px',
  horizontalReach: 'data-horizontal:w-full',
  vertical: 'data-vertical:w-px data-vertical:self-stretch',
} as const;
