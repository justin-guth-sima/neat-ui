/*
 * Spartan's field as `neat-field` and `neat-error-note` draw it: helm's classes, copied from the
 * vendored files named at each string because helm keeps them inline. field-classes.spec holds
 * each to its file both ways, so a helm update that adds or drops a class fails until this is
 * reviewed. The label over the control is the primary's (`ɵFIELD_LABEL_CLASSES`), which
 * `neat-select` shares. Class strings stay literals: Tailwind finds the classes the kit
 * stylesheet needs by reading them.
 */
export const FIELD_HELM_CLASSES = {
  /** `hlm-field.ts`: the field's own classes. */
  host: 'data-[matches-spartan-invalid=true]:text-destructive gap-3 group/field flex w-full',
  /** `hlm-field.ts`: its `vertical` orientation, the kit's only one. */
  vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
  /** `hlm-field-description.ts`: the hint under the control. */
  description: [
    'text-muted-foreground text-start text-sm [[data-variant=legend]+&]:-mt-1.5 leading-normal font-normal group-has-data-horizontal/field:text-balance',
    'last:mt-0 nth-last-2:-mt-1',
    '[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
  ],
  /** `hlm-field-error.ts`: the error under it. */
  error: 'text-destructive text-sm font-normal',
} as const;
