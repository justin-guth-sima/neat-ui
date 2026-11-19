/**
 * Scrolls `box`, and only `box`, so that `target` inside it is in view: on each axis where it is
 * not wholly in view, its start goes to the box's start, a line of context above it (its own
 * height) and the box's own inline padding before it. An axis where it is in view stays as it is.
 * Never `scrollIntoView`, which also scrolls the page and every other ancestor.
 */
export function scrollToShow(box: HTMLElement, target: Element, smooth: boolean): void {
  const view = box.getBoundingClientRect();
  const top = view.top + box.clientTop;
  const left = view.left + box.clientLeft;
  const shown = target.getBoundingClientRect();
  const outOfView = (start: number, end: number, from: number, size: number) =>
    start < from || end > from + size;

  let dy = 0;
  let dx = 0;
  if (outOfView(shown.top, shown.bottom, top, box.clientHeight)) {
    dy = shown.top - top - shown.height;
  }
  if (outOfView(shown.left, shown.right, left, box.clientWidth)) {
    dx = shown.left - left - parseFloat(getComputedStyle(box).paddingInlineStart || '0');
  }
  if (!dy && !dx) return;
  box.scrollTo({
    top: box.scrollTop + dy,
    left: box.scrollLeft + dx,
    behavior: smooth ? 'smooth' : 'instant',
  });
}
