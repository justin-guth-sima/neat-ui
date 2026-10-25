import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * The kit's one breakpoint, stated here and nowhere else: below 48rem (768 px) a screen is
 * narrow. Components react to what `NeatViewport` says through a host attribute, never through a
 * second `@media` rule with the same number.
 */
const NARROW_QUERY = '(width < 48rem)';

/**
 * Whether the screen is narrow, a phone's width. `narrow` follows the browser's media query live,
 * so turning a phone or resizing a window changes it at once; where the browser has no
 * `matchMedia` (a test environment) it stays `false`, a wide screen.
 *
 * Inject it rather than asking the browser, so the kit and the app share one answer and a test
 * can provide `{ narrow: signal(true) }` in its place.
 */
@Injectable({ providedIn: 'root' })
export class NeatViewport {
  private readonly state = signal(false);

  /** `true` while the viewport is narrower than 48rem. */
  readonly narrow = this.state.asReadonly();

  constructor() {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(NARROW_QUERY);
    this.state.set(query.matches);
    const follow = (event: { matches: boolean }): void => this.state.set(event.matches);
    query.addEventListener('change', follow);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', follow));
  }
}
