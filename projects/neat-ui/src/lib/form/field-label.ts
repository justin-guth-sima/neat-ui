/*
 * A form control's visible name over it, as `neat-field` and `neat-select` (with `showLabel`) both
 * draw it: one definition, so that fields side by side line up. It is Spartan's field, copied
 * from the vendored helm files named at each string (a drift spec reads them as text, so a helm
 * update that changes one fails until this is reviewed). With the same text size (hence line
 * height) for the name and the same gap under it, controls of one size in a row aligned at their
 * bottom edge have their names on one baseline. Class strings stay literals: Tailwind finds the
 * classes the kit stylesheet needs by reading them.
 */
export const FIELD_CLASSES = {
  /** `hlm-field.ts`: the field's own classes. */
  host: 'data-[matches-spartan-invalid=true]:text-destructive gap-3 group/field flex w-full',
  /** `hlm-field.ts`: its `vertical` orientation, the kit's only one. */
  vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
  /** `hlm-label.ts`: the name. */
  label:
    'gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed',
  /** `hlm-field-description.ts`: the hint under the control. */
  description: [
    'text-muted-foreground text-start text-sm [[data-variant=legend]+&]:-mt-1.5 leading-normal font-normal group-has-data-horizontal/field:text-balance',
    'last:mt-0 nth-last-2:-mt-1',
    '[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
  ],
  /** `hlm-field-error.ts`: the error under it. */
  error: 'text-destructive text-sm font-normal',
} as const;

export const FIELD_LABEL_CLASSES = {
  /** The column that holds the name and, under it, the control: helm's gap. */
  stack: 'flex flex-col gap-3',
  /** The name: helm's label. */
  label: FIELD_CLASSES.label,
} as const;
