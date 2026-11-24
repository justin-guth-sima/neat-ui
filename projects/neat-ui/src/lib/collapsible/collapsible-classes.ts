/*
 * The look of a section that a full-width button opens and closes, which `NeatCollapsible` draws
 * and the page nav takes on a narrow screen: one definition, so that both read as the
 * same control. Internal to the kit; the primary exports it `ɵ` for the collapsible entry. Class
 * strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading them.
 * Colors are the theme's tokens only; collapsible.spec holds the label and the summary to 4.5:1
 * on every surface. Helm's collapsible has one class, the closed content's `hidden`, which
 * `content` states through the preset's `data-closed` variant, so none is vendored.
 */
export const COLLAPSIBLE_CLASSES = {
  /**
   * The trigger: a full-width text button, its chevron, label and summary on one line. It draws
   * the kit's focus outline at full `--ring` (held to 3:1 by the theme). Hovering it brings the
   * chevron from the muted color to the text's, the only hover cue a button with no fill has.
   */
  trigger:
    'group flex w-full min-w-0 cursor-pointer items-center gap-(--neat-space-2) rounded-(--radius) py-1 text-start text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring',
  /**
   * The trigger of the `note` variant: only as wide as its content (`w-fit`, never past its
   * container), in the note's small muted text (`--neat-text-xs`, as `neatNote` and
   * `neatLineList` are) instead of the section's. Otherwise the section's trigger.
   */
  noteTrigger:
    'group flex w-fit max-w-full min-w-0 cursor-pointer items-center gap-(--neat-space-2) rounded-(--radius) py-1 text-start text-(length:--neat-text-xs) text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring',
  /**
   * The chevron: turned a quarter while open (`rotate-90`, which the trigger's owner sets), by a
   * transform the kit's transition duration times and that a reduced-motion setting turns into a
   * jump, as the kit's other motion is.
   */
  chevron:
    'shrink-0 text-muted-foreground transition-transform duration-(--neat-transition-duration) group-hover:text-foreground motion-reduce:transition-none',
  /** The label, which names the section and never gives way to the summary. */
  label: 'shrink-0 font-medium',
  /** The label of the `note` variant: in the trigger's text weight, as a note's words are. */
  noteLabel: 'shrink-0',
  /** The summary, shown while closed, muted, and the part that truncates. */
  summary: 'min-w-0 truncate text-muted-foreground',
  /**
   * The content. Brain makes it `inert` while closed (no focus, no clicks) but leaves it shown,
   * so the kit hides it: `data-state` is brain's, and the one variant is the content's only
   * display statement (a `div` is a block already), so no class has to lose to it.
   */
  content: 'pt-(--neat-space-2) data-closed:hidden',
} as const;
