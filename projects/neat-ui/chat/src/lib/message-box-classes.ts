import { ɵhlm as hlm } from '@sima/neat-ui';

/**
 * Helm's input-group classes (`lib/ui/input-group/src/lib/hlm-input-group*.ts`) and the textarea
 * its control hosts (`lib/ui/textarea/src/lib/hlm-textarea.ts`), copied because helm keeps them
 * inline: the group is the box's card, its block-start addon the pictures, its textarea the text
 * area and its block-end addon the row of buttons. message-box-classes.spec holds the table to the
 * vendored helm both ways, so a helm update that adds, drops or changes one fails until the table
 * is reviewed.
 */
export const INPUT_GROUP_HELM_CLASSES = {
  /** `hlm-input-group.ts`. */
  group:
    'border-input dark:bg-input/30 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][data-matches-spartan-invalid=true]]:ring-destructive/20 has-[[data-slot][data-matches-spartan-invalid=true]]:border-destructive dark:has-[[data-slot][data-matches-spartan-invalid=true]]:ring-destructive/40 h-9 rounded-md border shadow-xs transition-[color,box-shadow] in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot][data-matches-spartan-invalid=true]]:ring-3 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pe-1.5 has-[>[data-align=inline-start]]:[&>input]:ps-1.5 group/input-group relative flex w-full min-w-0 items-center outline-none has-[>textarea]:h-auto',
  /** `hlm-input-group-addon.ts`: every addon's classes. */
  addonBase:
    "text-muted-foreground h-auto gap-2 py-1.5 text-sm font-medium group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] flex cursor-text items-center justify-center select-none",
  /** `hlm-input-group-addon.ts`: the addons above and below the control, by their `align`. */
  addon: {
    'block-start':
      'px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2 order-first w-full justify-start',
    'block-end':
      'px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2 order-last w-full justify-start',
  },
  /** `hlm-input-group-textarea.ts`: the textarea, over helm's textarea classes. */
  textarea:
    'rounded-none border-0 bg-transparent py-2 shadow-none ring-0 focus-visible:ring-0 data-[matches-spartan-invalid=true]:ring-0 dark:bg-transparent flex-1 resize-none',
} as const;

/** `hlm-textarea.ts`: the textarea the input group's control hosts. */
export const TEXTAREA_HELM_CLASSES =
  'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 data-[matches-spartan-invalid=true]:ring-destructive/20 dark:data-[matches-spartan-invalid=true]:ring-destructive/40 data-[matches-spartan-invalid=true]:border-destructive dark:data-[matches-spartan-invalid=true]:border-destructive/50 rounded-md border bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] focus-visible:ring-3 data-[matches-spartan-invalid=true]:ring-3 md:text-sm placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50';

/**
 * What the message box changes about helm's classes, part by part: `additions` are merged over
 * helm's with `hlm`, which drops each helm class they replace, and `departures` names those, so
 * the spec can hold the merge to the list. Why each:
 *
 * - The card (the group): the box's edge is the frame's 2px of `--border` round the card, where the
 *   glows run, so the group draws no border, ring or shadow of its own (`border-0`,
 *   `shadow-none`, no focus ring: the frame takes `--ring` instead, as today); its corners are the
 *   box's, twice the radius; it is the card's fill in both schemes (helm's group is see-through,
 *   and tinted with `--input` in dark); it holds the parts 0.75rem in and 0.5rem apart, and stands
 *   over the glow (`z-1`). No transition: helm's eases a ring the box does not draw, and the
 *   transition alone changed how Chrome rasterized the edge's corners while focused.
 * - The text area: no padding of its own, since text scrolling under a padding would show cut lines
 *   past the card's inset; the base size at every width (helm's goes to `text-sm` from `md`); one
 *   line high when empty (helm's `min-h-16` is four) and eight at most, then it scrolls; not faded
 *   while the box is off, as the box was not; no transition, as for the card.
 * - The addons: no padding of their own (the card's inset is the one inset), the text color, size,
 *   weight and cursor of what they hold (helm's muted medium text and text cursor are for an addon of
 *   words beside an input, and spartan's addon does not focus the control on a click), and their
 *   text selectable; the pictures wrap.
 */
export const MESSAGE_BOX_CHANGES = {
  group: {
    departures: [
      'border',
      'rounded-md',
      'shadow-xs',
      'dark:bg-input/30',
      'has-[[data-slot=input-group-control]:focus-visible]:ring-3',
      'transition-[color,box-shadow]',
    ],
    additions: [
      'border-0',
      'rounded-[calc(var(--radius)*2)]',
      'shadow-none',
      'bg-card',
      'dark:bg-card',
      'has-[[data-slot=input-group-control]:focus-visible]:ring-0',
      'p-3',
      'gap-2',
      'z-1',
      '[--neat-surface:var(--card)]',
      'transition-none',
    ],
  },
  textarea: {
    departures: [
      'px-2.5',
      'py-2',
      'md:text-sm',
      'min-h-16',
      'disabled:opacity-50',
      'transition-[color,box-shadow]',
    ],
    additions: [
      'p-0',
      'md:text-base',
      'min-h-[1lh]',
      'max-h-[8lh]',
      'disabled:opacity-100',
      'transition-none',
    ],
  },
  pictures: {
    departures: ['py-1.5', 'px-2.5', 'pt-2', 'cursor-text'],
    additions: ['p-0', 'cursor-auto', 'flex-wrap'],
  },
  row: {
    departures: [
      'py-1.5',
      'px-2.5',
      'pb-2',
      'cursor-text',
      'text-muted-foreground',
      'font-medium',
      'text-sm',
      'select-none',
    ],
    additions: ['p-0', 'cursor-auto', 'text-inherit', 'font-normal', 'text-base', 'select-auto'],
  },
} as const;

const join = (...parts: string[]) => parts.join(' ');

/** Helm's own classes for each part, as helm composes them (the textarea over hlmTextarea). */
export const HELM_PARTS = {
  group: INPUT_GROUP_HELM_CLASSES.group,
  textarea: hlm(TEXTAREA_HELM_CLASSES, INPUT_GROUP_HELM_CLASSES.textarea),
  pictures: hlm(INPUT_GROUP_HELM_CLASSES.addonBase, INPUT_GROUP_HELM_CLASSES.addon['block-start']),
  row: hlm(INPUT_GROUP_HELM_CLASSES.addonBase, INPUT_GROUP_HELM_CLASSES.addon['block-end']),
} as const;

/** The classes each part of the message box takes: helm's, with the changes above merged over. */
export const MESSAGE_BOX_CLASSES = {
  group: hlm(HELM_PARTS.group, join(...MESSAGE_BOX_CHANGES.group.additions)),
  textarea: hlm(HELM_PARTS.textarea, join(...MESSAGE_BOX_CHANGES.textarea.additions)),
  pictures: hlm(HELM_PARTS.pictures, join(...MESSAGE_BOX_CHANGES.pictures.additions)),
  row: hlm(HELM_PARTS.row, join(...MESSAGE_BOX_CHANGES.row.additions)),
} as const;
