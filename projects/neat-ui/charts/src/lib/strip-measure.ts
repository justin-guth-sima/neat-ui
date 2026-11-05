/*
 * The label timeline's two measurements, kept here with the browser APIs they need, small and
 * tested on their own: the width of its strip, and how wide a name is drawn. The timeline calls
 * them after rendering and from the observer's callback, never while it computes what to draw.
 */

/**
 * Calls `report` with the element's width now, at each resize, and once the document's fonts have
 * loaded (a name measured in a fallback font has another width), until the returned stop is called.
 */
export function watchWidth(element: HTMLElement, report: (width: number) => void): () => void {
  let stopped = false;
  const now = () => {
    if (!stopped) report(element.getBoundingClientRect().width);
  };
  now();
  void document.fonts?.ready.then(now);
  if (typeof ResizeObserver !== 'function') {
    return () => {
      stopped = true;
    };
  }
  const observer = new ResizeObserver((entries) => {
    if (!stopped) report(entries[entries.length - 1].contentRect.width);
  });
  observer.observe(element);
  return () => {
    stopped = true;
    observer.disconnect();
  };
}

/** How wide `probe` is with `text` in it: a name as drawn, with whatever the probe's styles add. */
export function textWidth(probe: HTMLElement, text: string): number {
  probe.textContent = text;
  return probe.getBoundingClientRect().width;
}
