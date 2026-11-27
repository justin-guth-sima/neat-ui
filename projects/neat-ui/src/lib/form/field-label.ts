/*
 * A form control's visible name over it, as `neat-field` and `neat-select` (with `showLabel`) both
 * draw it: one definition, so that fields side by side line up. The name is Spartan's label,
 * copied from the vendored `hlm-label.ts` (field-label.spec holds it to that file both ways, so a
 * helm update that changes it fails until this is reviewed), in the gap Spartan's field leaves
 * under it. With the same text size (hence line height) for the name and the same gap under it,
 * controls of one size in a row aligned at their bottom edge have their names on one baseline.
 * The rest of the field's classes are the field entry's own. Class strings stay literals:
 * Tailwind finds the classes the kit stylesheet needs by reading them.
 */
export const FIELD_LABEL_CLASSES = {
  /** The column that holds the name and, under it, the control: helm's field gap. */
  stack: 'flex flex-col gap-3',
  /** The name: helm's label, as `hlm-label.ts` states it. */
  label:
    'gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed',
} as const;
