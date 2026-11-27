import { hlm } from '../ui/utils/src';

/*
 * A text field's look, which `neatInput` and `neat-search` draw: one
 * definition, so that every field in the kit looks the same. Internal to the kit; the primary
 * exports it `ɵ` for the input entry. Class strings stay literals: Tailwind finds the classes the
 * kit stylesheet needs by reading them.
 */

/**
 * Helm's input classes (`lib/ui/input/src/lib/hlm-input.ts`), copied because helm keeps them
 * inline. input.spec checks that the string still appears in the vendored helm, so a helm update
 * that changes it fails until this is reviewed.
 */
export const INPUT_HELM_CLASSES =
  'dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 data-[matches-spartan-invalid=true]:ring-destructive/20 dark:data-[matches-spartan-invalid=true]:ring-destructive/40 data-[matches-spartan-invalid=true]:border-destructive dark:data-[matches-spartan-invalid=true]:border-destructive/50 h-9 rounded-md border bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] file:h-7 file:text-sm file:font-medium focus-visible:ring-3 data-[matches-spartan-invalid=true]:ring-3 md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Where the kit departs from helm; each override exists because input.spec failed without it.
 * - Focus ring: helm's `ring-ring/50` is about 1.85:1 on white, where a focus indicator needs
 *   3:1; the kit draws full `--ring`, which the theme holds to it.
 * - Dark fill: helm tints the field with `--input` at 30%, which takes the placeholder to 4.2:1
 *   on a card. The field stays transparent as in light; its border marks it at 3:1 or more.
 */
const OVERRIDES = 'focus-visible:ring-ring dark:bg-transparent';

/**
 * The field at each of the kit's heights: `medium` is helm's `h-9` (2.25rem, the kit's medium
 * button), `small` is `h-8` (2rem, its small one).
 */
export const INPUT_CLASSES = {
  medium: hlm(INPUT_HELM_CLASSES, OVERRIDES),
  small: hlm(INPUT_HELM_CLASSES, OVERRIDES, 'h-8'),
} as const;
