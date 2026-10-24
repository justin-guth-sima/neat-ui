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
 * Two columns: the terms as wide as the widest, the values taking the rest. A value may hold a
 * long unbroken string (a URL, a path), so it can shrink with its column and wraps anywhere; its
 * figures are tabular, so numbers that change in place do not jitter.
 */
const DETAILS_CLASSES =
  'm-0 grid grid-cols-[auto_1fr] gap-x-(--neat-space-3) gap-y-(--neat-space-2) text-(length:--neat-text-sm) [&>dt]:text-muted-foreground [&>dd]:m-0 [&>dd]:min-w-0 [&>dd]:wrap-anywhere [&>dd]:tabular-nums';

/**
 * Facts about the selected thing, as a side panel shows them: a native description list whose
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
 */
@Directive({
  selector: 'dl[neatDetails]',
  host: { class: DETAILS_CLASSES },
})
export class NeatDetails {}
