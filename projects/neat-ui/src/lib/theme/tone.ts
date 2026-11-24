/**
 * What a status color says.
 *
 * It says nothing in particular (`neutral`), that it went well, to take note, that it failed, or
 * that it is for information. `highlight`, the brand purple, is a distinct state that is none of
 * these.
 *
 * A status chip's fill and a select-list row's tint both take it. So a row and its chip, given the
 * same tone, say the same.
 */
export type NeatTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'highlight';

/**
 * The color of a tone's dot, one place for every part that draws one (the rail item's state dot,
 * the collapsible's). A part sets `--neat-tone-dot` on its dot from this and paints
 * `background: var(--neat-tone-dot)`, so two dots of one tone never differ.
 *
 * The theme's `--warning` is a fill (2.2:1 on white), too faint for a dot, so warning's dot is the
 * line step of its scale, `--neat-line-warning`. Each color holds 3:1 on the rail and on its hover
 * fill in both schemes (the rail item spec).
 */
export const TONE_DOT_COLORS: Readonly<Record<NeatTone, string>> = {
  success: 'var(--success)',
  neutral: 'var(--muted-foreground)',
  warning: 'var(--neat-line-warning)',
  danger: 'var(--destructive)',
  info: 'var(--info)',
  highlight: 'var(--highlight)',
};
