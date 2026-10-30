/*
 * jsdom has no ResizeObserver and lays nothing out, so the diagram's specs stand one in that they
 * drive by hand: `resize` reports the border-box sizes a browser would have measured.
 */

/** The ResizeObservers created since `stubResizeObserver`, with what each one watches. */
const observers: FakeResizeObserver[] = [];

class FakeResizeObserver {
  readonly watched = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }

  observe(target: Element): void {
    this.watched.add(target);
  }

  unobserve(target: Element): void {
    this.watched.delete(target);
  }

  disconnect(): void {
    this.watched.clear();
  }

  report(sizes: ReadonlyMap<Element, { w: number; h: number }>): void {
    const entries = [...sizes]
      .filter(([target]) => this.watched.has(target))
      .map(
        ([target, { w, h }]) =>
          ({
            target,
            borderBoxSize: [{ inlineSize: w, blockSize: h }],
          }) as unknown as ResizeObserverEntry,
      );
    if (entries.length) this.callback(entries, this as unknown as ResizeObserver);
  }
}

/** Puts the stand-in in place of `ResizeObserver` (undone by `vi.unstubAllGlobals`). */
export function stubResizeObserver(): void {
  observers.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
}

/** Reports each element's size to the observers watching it, as a browser would after layout. */
export function resize(sizes: ReadonlyMap<Element, { w: number; h: number }>): void {
  for (const observer of observers) observer.report(sizes);
}

/** The elements the observers are watching now. */
export function watched(): Element[] {
  return observers.flatMap((observer) => [...observer.watched]);
}
