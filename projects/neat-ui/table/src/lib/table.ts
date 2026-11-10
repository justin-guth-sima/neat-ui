import { Directive } from '@angular/core';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. The values are the theme's `--border` and `--muted-foreground` and the kit's layout tokens.
 *
 * The cells are the app's own `th` and `td` elements, so the table styles them through child
 * variants (`[&_:where(th,td)]:`) rather than asking for a directive on each. Every rule is
 * stated once and no rule outweighs another: a cell gets exactly one alignment (the start default
 * leaves out the cells marked numeric, which the end rule picks), and the figure look has its own
 * marker. The rules are written in `:where`, so they weigh as little as a selector can; what lets
 * a table's plain rule of its own (a panel's flush edges, a group heading) override them is that
 * the kit's utilities are in `@layer utilities` and a component's CSS is not in any layer.
 */

/**
 * Full inline size, collapsed borders, the small text size. A cell is padded by the layout tokens,
 * ruled off below by `--border`, start-aligned (but for a numeric one) and vertically centered; a
 * header cell is medium-weight, and a column heading (a `th` in the `thead`) is muted and extra
 * small. A figure (marked `data-figure`) keeps to one line with tabular digits, and a numeric one
 * (marked `data-numeric`) is end-aligned.
 */
const TABLE_CLASSES =
  'w-full border-collapse text-(length:--neat-text-sm) [&_:where(th,td)]:px-(--neat-space-3) [&_:where(th,td)]:py-(--neat-space-2) [&_:where(th,td)]:border-be [&_:where(th,td)]:border-border [&_:where(th,td)]:align-middle [&_:where(th,td):where(:not([data-numeric]))]:text-start [&_:where([data-numeric])]:text-end [&_:where([data-figure])]:whitespace-nowrap [&_:where([data-figure])]:tabular-nums [&_:where(th)]:font-medium [&_:where(thead_th)]:text-muted-foreground [&_:where(thead_th)]:text-(length:--neat-text-xs)';

/**
 * A data table's look (full width, a rule under every row, the column headings muted and small),
 * on a native `table` whose rows and cells the app writes:
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
 * A figure's cell or heading, `th` or `td` of a `neatTable`, that keeps to one line with tabular
 * digits so that the figures of a column line up, and starts where any cell does. It only marks
 * the cell; the look is the table's, which is why the cell does nothing outside one. Use it where
 * the figures cannot end-align (a cell that holds something after the figure); otherwise use
 * `neatNumeric`.
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
