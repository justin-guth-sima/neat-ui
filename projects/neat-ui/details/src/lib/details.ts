import { Directive } from '@angular/core';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. The values are the theme's `--muted-foreground` and the kit's layout tokens.
 *
 * The terms and values are the app's own `dt` and `dd` elements, so the list styles them through
 * child variants (`[&>dt]:`) rather than asking for a directive on each: conditional pairs
 * (`@if` around a `dt` and its `dd`) stay plain markup.
 */

/**
 * Two columns: the terms as wide as the widest (or `--neat-details-term-width`, which an app sets
 * on an ancestor to line several lists up on one term column), the values taking the rest. A value
 * may hold a long unbroken string (a URL, a path), so it can shrink with its column and wraps
 * anywhere; its figures are tabular, so numbers that change in place do not jitter. A term wider
 * than a fixed term column breaks inside the word instead of running into the values; it breaks
 * only when it must (`break-word`, not `anywhere`), so the auto column still sizes to the terms'
 * real widths.
 */
const DETAILS_CLASSES =
  'm-0 grid grid-cols-[var(--neat-details-term-width,auto)_1fr] gap-x-(--neat-space-3) gap-y-(--neat-space-2) text-(length:--neat-text-sm) [&>dt]:wrap-break-word [&>dt]:text-muted-foreground [&>dd]:m-0 [&>dd]:min-w-0 [&>dd]:wrap-anywhere [&>dd]:tabular-nums';

/**
 * Facts about the selected thing, as an aside shows them: a native description list whose
 * terms are muted and whose values sit beside them:
 *
 * ```html
 * <dl neatDetails>
 *   <dt>Stream</dt><dd>{{ status.stream }}</dd>
 *   @if (source(); as source) {
 *     <dt>Source</dt><dd><code>{{ source }}</code></dd>
 *   }
 * </dl>
 * ```
 *
 * It sets the look only; the pairs, their words and what a value holds (a code span, an inline
 * button beside a URL) are the app's. Write each `dt` and `dd` as a direct child of the list, one
 * value per term: the two columns are the list's grid.
 *
 * The terms are muted and as wide as the widest; the values take the rest of the width, wrap
 * anywhere when long and keep their figures aligned. Several lists line up on one term column when
 * an ancestor sets `--neat-details-term-width` (a length, say `7rem`); a term wider than that
 * column breaks inside the word.
 */
@Directive({
  selector: 'dl[neatDetails]',
  host: { class: DETAILS_CLASSES },
})
export class NeatDetails {}
