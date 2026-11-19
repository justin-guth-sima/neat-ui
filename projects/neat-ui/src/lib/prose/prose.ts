import { Directive } from '@angular/core';

/**
 * Long-form text in the kit's type: the headings, paragraphs, lists, links, code, keys, quotes and
 * rules inside its host.
 *
 * ```html
 * <article neatProse>
 *   <h2>Connect a camera</h2>
 *   <p>Add it on the <a routerLink="/media">Media</a> page, then press <kbd>Enter</kbd>.</p>
 *   <ul>
 *     <li>An RTSP camera needs its address, such as <code>rtsp://…/stream1</code>.</li>
 *     <li>A USB camera shows up by itself.</li>
 *   </ul>
 * </article>
 * ```
 *
 * Use it for text a page shows at length: help, an explanation, a README. The elements inside are
 * plain HTML, so content set with `[innerHTML]` (a README converted from Markdown) is styled too.
 * Outside it, the kit's reset stays: lists have no markers and links no underline.
 *
 * What it styles:
 *
 * - Blocks are `--neat-space-3` apart. A heading or a rule is `--neat-space-6` below what comes
 *   before it.
 * - `h1`, `h2` and `h4` keep the kit's sizes. `h3` is a step above the text, and `h5` and `h6` a
 *   step below, `h6` muted.
 * - Lists have bullets or numbers, muted, and are inset by `--neat-space-6`. Their items are
 *   `--neat-space-2` apart, and a list may hold another.
 * - A link is underlined and medium weight, in its text's color. So it holds the contrast of its
 *   text on any surface, and the underline, not a color, marks it.
 * - Inline code has the size of `code[neatCode]`, on a `--muted` chip. Code in a `pre` is left as
 *   it is.
 * - A `kbd` is a key as `neat-shortcut` draws one.
 * - A quote is muted, with a border at its start.
 *
 * It sets no font size and no width. The text takes its container's size, and the app sets the
 * measure (the showcase's pages use 46rem to 52rem).
 *
 * It styles its own flow: its children, the items of its lists and its quotes, and the links, code
 * and keys in their text. A kit part placed in it, such as a chart or a callout, is spaced as a
 * block and keeps its own look. Text inside such a part is not the prose's. Mark that text with
 * `neatProse` too where it is long-form.
 *
 * Its rules weigh the least of the kit's styles, so a kit part and the app's own styles override
 * them. The host stays a block: a flex or grid host would add its gap to the spacing.
 */
@Directive({
  selector: '[neatProse]',
  host: { class: 'neat-prose' },
})
export class NeatProse {}
