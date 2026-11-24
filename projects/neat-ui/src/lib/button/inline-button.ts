import { Directive } from '@angular/core';
import { BrnButton } from '@spartan-ng/brain/button';
import { buttonVariants } from '../ui/button/src';
import { hlm } from '../ui/utils/src';

/**
 * Helm's link variant made to sit inside a line of text:
 * - no box: the size's height, padding (also the padding helm gives a `data-icon` child) and
 *   transparent border go (tailwind-merge drops the conflicting classes);
 * - the line's font size and color, so the action reads like the text around it, at the contrast
 *   the theme guarantees for that text; helm's `text-primary` would stand out of a muted line and
 *   drops to about 4.1:1 on `--accent` in light;
 * - the kit's full-strength focus ring, for the reason `NeatButton` gives;
 * - its text on the line's baseline: helm centers its items, so a leading icon, which has no
 *   baseline, would set the button's and push the text below the words around it.
 *
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading them.
 */
const CLASSES = hlm(
  buttonVariants({ variant: 'link' }),
  'h-auto border-0 p-0 has-data-[icon=inline-end]:pr-0 has-data-[icon=inline-start]:pl-0 text-[length:inherit] text-inherit focus-visible:ring-ring items-baseline [&_neat-icon]:self-center',
);

/**
 * A text action set into a line of text, such as "Use global" at the end of a list line.
 *
 * ```html
 * <button neatInlineButton type="button" (click)="useGlobal()">Use global</button>
 * ```
 *
 * It is medium weight and underlined on hover, as tall as its text, in the font size and color of
 * its parent. Its label does not wrap, so keep it to a few words.
 *
 * Use `neatButton` for actions that stand on their own. This one is for dense lines, where a
 * `neatButton`'s 2rem height would set the line height. When several lines sit in a column, keep
 * each at least 1.5rem high (`min-block-size`), so the targets stay apart (WCAG 2.5.8).
 *
 * @input disabled Turns the action off: dimmed, out of the Tab order and not clickable (a link
 * gets no `disabled` attribute but the same look and `tabindex="-1"`).
 */
@Directive({
  selector: 'button[neatInlineButton], a[neatInlineButton]',
  hostDirectives: [{ directive: BrnButton, inputs: ['disabled'] }],
  host: {
    'data-slot': 'button',
    '[class]': 'classes',
  },
})
export class NeatInlineButton {
  protected readonly classes = CLASSES;
}
