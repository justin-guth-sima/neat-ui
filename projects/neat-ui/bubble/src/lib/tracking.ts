/**
 * Follows a bubble's anchor while the bubble shows, outside Angular: anything that can move the
 * anchor or change the bubble's size asks for a new placement, at most once an animation frame,
 * and the anchor scrolled out of view (clipped by a scrolling box around it, or by the window)
 * hides the bubble, so it never floats over a top bar or another card.
 *
 * - A scroll anywhere (a listener in the capture phase on the document, since a scroll event does
 *   not bubble) and the window resizing, since any scrolling box around the anchor moves it.
 * - The bubble's and the anchor's own sizes (`ResizeObserver`, where there is one): new content in
 *   the bubble, or code that wraps anew.
 * - Whether any anchor element is in view (`IntersectionObserver` with the viewport as its root,
 *   which takes every clipping box between them into account); without one it stays shown.
 *
 * Returns the function that stops all of it.
 */
export function trackAnchor(
  view: Window & typeof globalThis,
  anchors: readonly Element[],
  bubble: Element,
  place: () => void,
  shown: (visible: boolean) => void,
): () => void {
  let frame = 0;
  const schedule = () => {
    if (!frame) {
      frame = view.requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    }
  };
  const document = view.document;
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  view.addEventListener('resize', schedule, { passive: true });

  const resize = view.ResizeObserver ? new view.ResizeObserver(schedule) : undefined;
  resize?.observe(bubble);
  anchors.forEach((anchor) => resize?.observe(anchor));

  const inView = new Set<Element>();
  const intersect = view.IntersectionObserver
    ? new view.IntersectionObserver((entries: IntersectionObserverEntry[]) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inView.add(entry.target);
          else inView.delete(entry.target);
        }
        shown(inView.size > 0);
      })
    : undefined;
  anchors.forEach((anchor) => intersect?.observe(anchor));

  return () => {
    document.removeEventListener('scroll', schedule, { capture: true });
    view.removeEventListener('resize', schedule);
    resize?.disconnect();
    intersect?.disconnect();
    if (frame) view.cancelAnimationFrame(frame);
  };
}
