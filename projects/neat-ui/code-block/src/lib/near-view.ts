/**
 * How near the view a block counts as near: half the view's height above and below it, so a block
 * a little below the fold is colored by the time it scrolls in. A kit page scrolls its own body,
 * not the window, and a root margin grows only the window, so `scrollMargin` grows every box that
 * scrolls the block by as much. That head start holds where the browser supports `scrollMargin`
 * (Chromium, and Firefox since 157); elsewhere a block in a page's body colors as it enters the
 * view.
 */
export const NEAR_MARGIN = '50% 0px';

/**
 * Calls `near` once, when `element` first comes near the view (an `IntersectionObserver` with the
 * viewport as its root, `NEAR_MARGIN` around it), then stops watching. Without a window or an
 * `IntersectionObserver` (jsdom, an old browser) the element is near at once. Call it outside
 * Angular: the observer's callback then runs outside change detection.
 *
 * Returns the function that stops watching sooner.
 */
export function watchNearView(
  view: (Window & typeof globalThis) | null,
  element: Element,
  near: () => void,
): () => void {
  if (!view?.IntersectionObserver) {
    near();
    return () => undefined;
  }
  const observer = new view.IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      near();
    },
    { rootMargin: NEAR_MARGIN, scrollMargin: NEAR_MARGIN },
  );
  observer.observe(element);
  return () => observer.disconnect();
}
