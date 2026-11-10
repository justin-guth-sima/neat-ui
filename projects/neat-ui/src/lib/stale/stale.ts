import { computed, Directive, input } from '@angular/core';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. `opacity-55` is opacity 0.55 and `grayscale` is `filter: grayscale(100%)`.
 */
export const STALE_CLASSES = 'opacity-55 grayscale';

/**
 * Shows that what the host shows is stale, faded and gray.
 *
 * ```html
 * <span [neatStale]="lost()">12.4 fps</span>
 * ```
 *
 * Use it for a figure from before a connection dropped, or a frame of a stream that stopped. While
 * true, the host is faded and gray. Once fresh, it is shown as it is.
 *
 * The change is instant, with no transition, so a value that comes back is never shown half-faded
 * as if still in doubt.
 *
 * It is the look only. The app says in words why the value is stale, since gray alone tells no one
 * what happened.
 */
@Directive({
  selector: '[neatStale]',
  host: { '[class]': 'classes()' },
})
export class NeatStale {
  /** Whether what the host shows is stale. */
  readonly neatStale = input.required<boolean>();

  protected readonly classes = computed(() => (this.neatStale() ? STALE_CLASSES : ''));
}
