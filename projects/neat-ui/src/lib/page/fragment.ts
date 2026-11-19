/*
 * What `neat-page` needs to follow a URL's fragment: the in-page link a click asks for, and the
 * scroll of one of the page's own boxes to the element the fragment names. The router's own anchor
 * scrolling moves the window, which never scrolls in a kit app: the page's body does.
 */

/**
 * The id a plain click on an in-page link (`<a href="#setup">`) inside `page` asks for, or null
 * for any other click: one with a modifier or another button, one the link's own handler took
 * (a `routerLink`), a link that opens elsewhere or downloads, a bare `#`, or a link inside a page
 * nested in this one, which follows it itself.
 */
export function inPageLinkTarget(event: MouseEvent, page: HTMLElement): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return null;
  const link = (event.target as Element | null)?.closest?.('a[href]');
  if (!link || link.closest('neat-page') !== page) return null;
  const target = link.getAttribute('target');
  if ((target && target !== '_self') || link.hasAttribute('download')) return null;
  const href = link.getAttribute('href') ?? '';
  if (!href.startsWith('#') || href.length === 1) return null;
  try {
    return decodeURIComponent(href.slice(1));
  } catch {
    // A malformed escape: the id is what the link says.
    return href.slice(1);
  }
}

/**
 * Scrolls `box` alone, never its ancestors, so `target` sits at its top: below the box's
 * `scroll-padding-top` and the target's own `scroll-margin-top`, as the browser places a fragment.
 * `scrollIntoView` would scroll every ancestor too, the page's clipped boxes included, and shift
 * the layout.
 */
export function scrollToTarget(target: Element, box: HTMLElement, smooth: boolean): void {
  const padding = length(getComputedStyle(box).scrollPaddingTop, box.clientHeight);
  const margin = length(getComputedStyle(target).scrollMarginTop, 0);
  const offset = target.getBoundingClientRect().top - box.getBoundingClientRect().top;
  box.scrollTo({
    top: Math.max(0, box.scrollTop + offset - padding - margin),
    behavior: smooth ? 'smooth' : 'instant',
  });
}

/** A computed length in pixels, a percentage of `basis`; `auto` and anything else are 0. */
function length(value: string, basis: number): number {
  const number = parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return value.trim().endsWith('%') ? (number / 100) * basis : number;
}
