import { hlm } from '../ui/utils/src';

/**
 * Helm's popover classes (`lib/ui/popover`), copied because helm keeps them inline. popover.spec
 * checks that the string still appears in the vendored helm, so a helm update that changes it
 * fails until this table is reviewed. Internal to the kit; `neat-popover` re-exports it for that
 * spec.
 */
export const POPOVER_HELM_CLASSES = {
  /** `hlm-popover-content.ts`: the panel. */
  content:
    'bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 gap-4 rounded-md p-4 text-sm shadow-md ring-1 duration-100 relative flex w-72 flex-col outline-none',
} as const;

/**
 * The surface of a panel in the CDK overlay, which `neat-popover` and the collapsed rail's menu
 * share: helm's, outlined in `--border`, the theme's colour for card outlines and dividers, where
 * helm draws the text colour at 10%. It sets `--neat-surface` to its fill, `--popover`: what the
 * content sits on, so that a part that covers what scrolls under it (a select list's sticky
 * header) fills with the panel's colour, not the page's. Each panel states its own size, padding
 * and gap after it. Internal to the kit; `ɵPANEL_SURFACE_CLASSES` for the secondary entries.
 */
export const PANEL_SURFACE_CLASSES = hlm(
  POPOVER_HELM_CLASSES.content,
  'ring-border [--neat-surface:var(--popover)]',
);
