import { Directive } from '@angular/core';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. The values are Spartan's table look (helm's `hlm-table.ts`, held by a drift spec), written
 * for plain elements: helm gives each element a directive of its own, but the app writes plain
 * `thead`, `tr`, `th` and `td` (so does `neat-markdown`), so the one directive on the `table`
 * styles them through child variants (`[&_:where(tr)]:`) rather than asking for a directive on each.
 * Every rule is stated once and no rule outweighs another: a cell gets exactly one alignment (the
 * start default leaves out the cells marked numeric, which the end rule picks), and the figure
 * look has its own marker. Each selector, pseudo-classes and attributes included, sits wholly in
 * `:where`, so it weighs as little as a selector can; what lets a table's plain rule of its own
 * (a panel's flush edges, a group heading) override them is that the kit's utilities are in
 * `@layer utilities` and a component's CSS is not in any layer.
 */

/**
 * Helm's table: full inline size, the caption below, the small text size; collapsed borders, which
 * the rows' rules need. A row is ruled off below and fills `--accent` under the pointer (where
 * there is one), while a control in it is expanded and while it is `data-state="selected"`, which
 * wins over both. Every row but the last of the body and of the footer has the rule, stated on
 * those rows rather than taken off the last, where it would lose to the row's own. The footer has
 * a rule above it, an `--accent` fill and medium weight. A header cell (every `th`, a row heading
 * too) is 2.5rem high, medium-weight and in the text color; a cell is padded by 0.5rem; a column
 * heading stays on one line, a body cell wraps. A figure (marked `data-figure`) keeps to one line
 * with tabular digits, and a numeric one (marked `data-numeric`) is end-aligned.
 *
 * Departures from helm, each held by table.spec:
 * - The fills are `--accent`, the select list's hover and selected fill, where helm's are
 *   `--muted` (selected) and `--muted` at half strength (hover, expanded, footer). `--muted` is
 *   about 1.10:1 on white and is the card's and the dialog's own color in dark, so on a card or in
 *   a dialog the selection vanished; `--accent` is held to show on the page and on those surfaces
 *   in both schemes. A hovered row and a selected one take the same fill, as in the select list.
 * - Body cells wrap, where helm keeps every cell on one line (`whitespace-nowrap`): `neatTable`
 *   styles prose (a chat reply's markdown) and app tables whose cells hold sentences, which must
 *   not run past their container. Only the column headings and the figures stay on one line.
 * - Helm's `[&:has([role=checkbox])]:pe-0` on a cell is left out: a cell that holds a checkbox
 *   keeps its end padding, since the kit has no table checkbox column to tighten.
 */
const TABLE_CLASSES =
  'w-full border-collapse caption-bottom text-sm [&_:where(thead_tr,tbody_tr:not(:last-child),tfoot_tr:not(:last-child))]:border-b [&_:where(tr)]:border-border [&_:where(tr)]:transition-colors [@media(hover:hover)]:[&_:where(tr:hover:not([data-state=selected]))]:bg-accent [&_:where(tr:has([aria-expanded=true]):not([data-state=selected]))]:bg-accent [&_:where(tr[data-state=selected])]:bg-accent [&_:where(tfoot)]:border-t [&_:where(tfoot)]:bg-accent [&_:where(tfoot)]:font-medium [&_:where(th)]:h-10 [&_:where(th)]:px-2 [&_:where(th)]:font-medium [&_:where(th)]:text-foreground [&_:where(td)]:p-2 [&_:where(th,td)]:align-middle [&_:where(thead_th)]:whitespace-nowrap [&_:where(th,td):where(:not([data-numeric]))]:text-start [&_:where([data-numeric])]:text-end [&_:where([data-figure])]:whitespace-nowrap [&_:where([data-figure])]:tabular-nums [&_:where(caption)]:mt-4 [&_:where(caption)]:text-sm [&_:where(caption)]:text-muted-foreground';

/**
 * A data table's look, on a native `table` whose rows and cells the app writes.
 *
 * ```html
 * <table neatTable aria-label="Metrics of the run">
 *   <thead>
 *     <tr><th scope="col">Metric</th><th scope="col" neatNumeric>Mean</th></tr>
 *   </thead>
 *   <tbody>
 *     <tr><th scope="row">Power</th><td neatNumeric>12.5 W</td></tr>
 *   </tbody>
 * </table>
 * ```
 *
 * The table is Spartan's: full width, a rule under every row, a row filling under the pointer, and
 * its headings medium-weight.
 *
 * It sets the look only. The columns and what a cell holds are the app's. So is how a table gives
 * up a column when its container is narrow: the kit cannot know the container, or which columns
 * matter.
 * The table's name for assistive technology is the app's too (`aria-label`).
 */
@Directive({
  selector: 'table[neatTable]',
  host: { class: TABLE_CLASSES },
})
export class NeatTable {}

/**
 * A figure's cell or heading in a `neatTable`, on one line with tabular digits, not end-aligned.
 *
 * Put it on a `th` or `td`. The figures of a column line up, and the cell starts where any cell
 * does. Use it where the figures cannot end-align, such as a cell that holds something after the
 * figure. Otherwise use `neatNumeric`.
 *
 * It only marks the cell. The look is the table's, which is why the cell does nothing outside one.
 */
@Directive({
  selector: 'td[neatFigure], th[neatFigure]',
  host: { 'data-figure': '' },
})
export class NeatFigure {}

/**
 * A figure's cell or heading as `neatFigure`, end-aligned as well. Put it on a column's heading
 * as well as on its cells so that the heading sits over the figures. It marks the cell as a
 * figure itself, so the cell needs no `neatFigure` beside it.
 */
@Directive({
  selector: 'td[neatNumeric], th[neatNumeric]',
  host: { 'data-figure': '', 'data-numeric': '' },
})
export class NeatNumeric {}
