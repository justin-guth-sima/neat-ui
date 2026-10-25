import { Directive } from '@angular/core';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. The values are the theme's `--border` and `--muted-foreground` and the kit's layout tokens.
 *
 * The cells are the app's own `th` and `td` elements, so the table styles them through child
 * variants (`[&_:where(th,td)]:`) rather than asking for a directive on each. The defaults sit in
 * `:where`, which weighs nothing, so a table that needs its cells to differ (a panel's flush
 * edges, a group heading) says so in a plain rule of its own. The numeric cells are the one
 * exception: they are chosen by their attribute, which outweighs the defaults by specificity
 * instead of by the order Tailwind happens to emit the rules in.
 */

/**
 * Full inline size, collapsed borders, the small text size. A cell is padded by the layout tokens,
 * ruled off below by `--border`, start-aligned and vertically centred; a header cell is
 * medium-weight, and a column heading (a `th` in the `thead`) is muted and extra small.
 */
const TABLE_CLASSES =
  'w-full border-collapse text-(length:--neat-text-sm) [&_:where(th,td)]:px-(--neat-space-3) [&_:where(th,td)]:py-(--neat-space-2) [&_:where(th,td)]:border-be [&_:where(th,td)]:border-border [&_:where(th,td)]:text-start [&_:where(th,td)]:align-middle [&_:where(th)]:font-medium [&_:where(thead_th)]:text-muted-foreground [&_:where(thead_th)]:text-(length:--neat-text-xs) [&_[data-numeric]]:text-end [&_[data-numeric]]:whitespace-nowrap [&_[data-numeric]]:tabular-nums';

/**
 * A data table's look, on a native `table` whose rows and cells the app writes:
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
 * It sets the look only: the columns, what a cell holds and how a table gives up a column when
 * its container is narrow are the app's (the kit cannot know the container, or which columns
 * matter). The table's name for assistive technology is the app's too (`aria-label`).
 */
@Directive({
  selector: 'table[neatTable]',
  host: { class: TABLE_CLASSES },
})
export class NeatTable {}

/**
 * A figure's cell or heading, `th` or `td` of a `neatTable`: end-aligned, on one line, with tabular
 * digits so that the figures of a column line up. It only marks the cell; the look is the table's,
 * which is why the cell does nothing outside one. Put it on a column's heading as well as on its
 * cells so that the heading sits over the figures.
 */
@Directive({
  selector: 'td[neatNumeric], th[neatNumeric]',
  host: { 'data-numeric': '' },
})
export class NeatNumeric {}
