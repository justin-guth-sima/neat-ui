import { Directive } from '@angular/core';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. The values are the kit's layout tokens (`--neat-space-*`, `--neat-text-xs`).
 */

/**
 * The list: no bullets, no margin, under a 2px rule on the inline start with an inset, in the
 * small text size.
 */
const LIST_CLASSES =
  'm-0 p-0 list-none ps-(--neat-space-3) border-s-2 border-border text-(length:--neat-text-xs)';

/**
 * A line is a row with a small gap. At least 1.5rem high keeps the targets of `neatInlineButton`
 * actions apart (WCAG 2.5.8's spacing exception): the buttons are only as tall as their text, so
 * the lines add the height, not padding.
 */
const LINE_CLASSES = 'flex items-center gap-(--neat-space-2) min-h-6';

/** Pushes an element to the end of its line. */
const END_CLASSES = 'ms-auto';

/**
 * A short list of small lines under a thin rule, such as the channels that override a setting.
 *
 * ```html
 * <ul neatLineList>
 *   <li neatLine>
 *     Channel 3 <button neatInlineButton neatLineEnd type="button">Use global</button>
 *   </li>
 * </ul>
 * ```
 *
 * It sets the look only: the rule, the inset, the text size. A line's content, and the roles of the
 * list, are the app's. The text color is the parent's.
 */
@Directive({
  selector: 'ul[neatLineList], ol[neatLineList]',
  host: { class: LIST_CLASSES },
})
export class NeatLineList {}

/**
 * One line of a `neatLineList`, its parts side by side.
 *
 * It is a flex row, at least 1.5rem high, so the buttons of neighboring lines keep their distance.
 */
@Directive({
  selector: 'li[neatLine]',
  host: { class: LINE_CLASSES },
})
export class NeatLine {}

/**
 * Marks the element of a `neatLine` that sits at the line's end, such as its action.
 *
 * The action is usually a `neatInlineButton`. It is pushed to the end, whatever the text before it
 * takes.
 */
@Directive({
  selector: '[neatLineEnd]',
  host: { class: END_CLASSES },
})
export class NeatLineEnd {}
