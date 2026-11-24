// A fake of the browser's IntersectionObserver for the specs of the code-block entry, so a spec
// says when a block comes near the view. Not part of the package.

/** An observer that records what it watches and how, and lets a spec call it back. */
export class FakeIntersectionObserver {
  static last: FakeIntersectionObserver | undefined;
  readonly watched: Element[] = [];
  disconnected = false;
  constructor(
    readonly callback: (entries: { target: Element; isIntersecting: boolean }[]) => void,
    readonly options: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.last = this;
  }
  observe(element: Element) {
    this.watched.push(element);
  }
  disconnect() {
    this.disconnected = true;
  }
  /** Reports each watched element in view or out of it, as the browser would. */
  report(isIntersecting: boolean) {
    this.callback(this.watched.map((target) => ({ target, isIntersecting })));
  }
}
