/*
 * jsdom has no ResizeObserver and lays nothing out, so the charts' specs stand one in that they
 * drive by hand: `resize` reports the content width a browser would have measured.
 */

/** The ResizeObservers created since `stubResizeObserver`. */
const observers: FakeResizeObserver[] = [];

class FakeResizeObserver {
  readonly watched = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }

  observe(target: Element): void {
    this.watched.add(target);
  }

  disconnect(): void {
    this.watched.clear();
  }

  report(target: Element, width: number): void {
    if (!this.watched.has(target)) return;
    const entry = { target, contentRect: { width } } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
}

/** Puts the stand-in in place of `ResizeObserver` (undone by `vi.unstubAllGlobals`). */
export function stubResizeObserver(): void {
  observers.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
}

/** Reports `target`'s new width to the observers watching it, as a browser would after layout. */
export function resize(target: Element, width: number): void {
  for (const observer of observers) observer.report(target, width);
}

/** The elements the observers are watching now. */
export function watched(): Element[] {
  return observers.flatMap((observer) => [...observer.watched]);
}
