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
 * - Headings `h1` to `h4`, paragraphs, bulleted lists, quotes and inline code are Spartan's
 *   typography, the same look the typography directives (`NEAT_TYPOGRAPHY`, such as `neatH2`)
 *   give single elements. So a page can mix the two without a seam.
 * - Blocks are 1.5rem apart, Spartan's space between blocks, with none before the first, so the
 *   container's edges stay free.
 * - `h5` and `h6`, which Spartan lacks, are a step below the text, `h6` muted.
 * - Lists have bullets or numbers, muted, and are inset by 1.5rem. Their items are 0.5rem apart,
 *   and a list may hold another. Blocks inside an item are `--neat-space-3` apart.
 * - A link is underlined and medium weight, in its text's color. So it holds the contrast of its
 *   text on any surface, and the underline, not a color, marks it.
 * - Inline code is `code[neatCode]`'s look, Spartan's chip. Code in a `pre` is left as it is.
 * - A `kbd` is a key as `neat-shortcut` draws one.
 * - A quote is italic, with a border at its start.
 *
 * It sets no size for the body text and no width. The text takes its container's size, and the
 * app sets the measure (the showcase's pages use 46rem to 52rem).
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
