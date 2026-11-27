import type { NeatTone } from '../theme/tone';
import { hlm } from '../ui/utils/src';

/*
 * The badge's look, which the badge entry's `neat-badge` and `button[neatBadge]`, the status
 * chip's deprecated aliases and the live badge draw: one definition, in the primary because the
 * live badge is the primary's and the primary may not import a secondary entry. Internal to the
 * kit; the primary exports it `ɵ`. Class strings stay literals: Tailwind finds the classes the kit
 * stylesheet needs by reading them. Colors are the theme's tokens only; badge-classes.spec holds
 * each tone's text to 4.5:1 on its fill in both schemes and both variants.
 */

/**
 * The badge's shape alone, which the live badge takes without the rest: the height, the pill
 * radius, the inline padding, the small text in medium weight, a centered flex row that does not
 * wrap. No tone colors, no `overflow-hidden` (the live dot's ring grows past the badge) and no
 * `truncate`. Helm's own classes; the badge's `BADGE_HELM_CLASSES` begins with them, so
 * badge-classes.spec's drift check against helm covers them.
 */
export const BADGE_SHAPE_CLASSES =
  'h-5 rounded-4xl px-2 text-xs font-medium inline-flex items-center whitespace-nowrap';

/**
 * Helm's badge classes (`lib/ui/badge/src/lib/hlm-badge.ts`, its `badgeVariants` base), copied
 * because helm keeps them inline and does not export them. badge-classes.spec reads the vendored
 * helm and holds the badge to its base both ways, the kit's departures and additions named, so a
 * helm update that adds or drops a class fails until this is reviewed. The kit takes the 1.25rem
 * height, the pill radius, the inline padding, the small text in medium weight and the rules for
 * an icon inside as they are; an icon is sized by its own `[size]`, 12 for helm's `--spacing(3)`.
 */
const BADGE_HELM_CLASSES = `${BADGE_SHAPE_CLASSES} gap-1 border border-transparent py-0.5 transition-all has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&>neat-icon]:text-[length:--spacing(3)] group/badge focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 w-fit shrink-0 justify-center overflow-hidden focus-visible:ring-[3px] [&>neat-icon]:pointer-events-none`;

/**
 * The kit's additions, merged over helm's (with `hlm`, so each replaces the helm class it names):
 * - `max-w-full truncate`: a badge is never wider than what holds it (a list's cell, a video
 *   tile's bar), and ends its text in an ellipsis at that width rather than widen it.
 * - `inline-block` in place of helm's `inline-flex`, while the badge holds no icon: a flex box
 *   cannot end its text in an ellipsis (its text is an anonymous flex item, which clips), and
 *   helm's `justify-center` centers text that overflows, so a cut badge lost the start of its
 *   words. With an icon inside it is helm's flex row again, for helm's gap and centering.
 * - `py-0 leading-4.5` in place of helm's `py-0.5` and the small text's own line height: the line
 *   fills the box inside the 1px border, so the text sits centered in a block as in a flex row.
 * - `align-middle`: a block that clips puts its baseline at its bottom edge, which would lift it
 *   above the text of the line it sits in.
 * - `shrink` in place of helm's `shrink-0`: in a crowded flex row a badge gives up width and cuts
 *   its text, as the status chip did, rather than run past the row. A badge that is a button keeps
 *   helm's `shrink-0` (`BADGE_BUTTON_CLASSES`).
 */
const KIT_CLASSES =
  'max-w-full truncate inline-block has-[>neat-icon]:inline-flex py-0 leading-4.5 align-middle shrink';

/** How a badge carries its tone, as the badge entry's `NeatBadgeVariant` names it. */
type BadgeVariant = 'soft' | 'solid';

/**
 * Each variant gives each tone a fill and a text color, in place of helm's own variants (helm's
 * `secondary` is the card's own color in dark and vanishes on a card).
 *
 * - Soft: the tone's row-tint accent (`--neat-tint-<tone>-accent`, opaque) under the tone's own
 *   color, as helm's destructive badge is its color on a tint of itself. Warning's own color is a
 *   fill, so its text is `--neat-warning-text`, the warning line mixed toward `--foreground` as far
 *   as reads on its tint.
 * - Solid: the tone's status fill and the text the theme pairs with it.
 *
 * Neutral is the same in both: muted text on `--neat-chip-neutral`, a gray that shows on the card,
 * the page and a hovered or selected row's `--accent` in both schemes (dark `--muted` is the
 * card's own gray). Every fill is opaque, so a badge reads the same on the page, a card, a dialog
 * and a toned list row.
 */
const TONE_CLASSES: Record<BadgeVariant, Record<NeatTone, string>> = {
  soft: {
    neutral: 'bg-neat-chip-neutral text-muted-foreground',
    success: 'bg-neat-tint-success-accent text-success',
    warning: 'bg-neat-tint-warning-accent text-neat-warning-text',
    danger: 'bg-neat-tint-danger-accent text-destructive',
    info: 'bg-neat-tint-info-accent text-info',
    highlight: 'bg-neat-tint-highlight-accent text-highlight',
  },
  solid: {
    neutral: 'bg-neat-chip-neutral text-muted-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
    danger: 'bg-destructive text-destructive-foreground',
    info: 'bg-info text-info-foreground',
    highlight: 'bg-highlight text-highlight-foreground',
  },
};

/** A badge's classes: helm's badge, the kit's truncation, and the tone's colors in the variant. */
export function badgeClasses(tone: NeatTone, variant: BadgeVariant): string {
  return hlm(BADGE_HELM_CLASSES, KIT_CLASSES, TONE_CLASSES[variant][tone]);
}

/**
 * What a badge that is a button adds, merged over `badgeClasses` (with `hlm`, so the focus ring's
 * color replaces helm's; which is why the button's classes are a function and not a string an
 * entry appends):
 * - the pointer;
 * - the focus ring at full `--ring`, which the theme holds to 3:1 on every surface, where helm's
 *   is the ring color at 50% (`ring-ring/50`), about 1.85:1 on white; the browser's own outline
 *   goes, as on the kit's buttons, since the ring is the focus indicator;
 * - the disabled look of the kit's buttons, dimmed with a not-allowed cursor;
 * - helm's `shrink-0` again, which keeps it whole in a row that shrinks, such as a video tile's bar
 *   beside a status that takes the rest: a control's name is not cut.
 */
const BADGE_BUTTON_CLASSES =
  'cursor-pointer outline-none focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 shrink-0';

/** A badge button's classes: the badge's, with `BADGE_BUTTON_CLASSES` merged over them. */
export function badgeButtonClasses(tone: NeatTone, variant: BadgeVariant): string {
  return hlm(badgeClasses(tone, variant), BADGE_BUTTON_CLASSES);
}
