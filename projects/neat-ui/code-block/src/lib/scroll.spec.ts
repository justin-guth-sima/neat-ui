import { scrollToShow } from './scroll';

/** A box of 200 × 100 px at (0, 0) with 8 px of inline padding, scrolled to `scroll`. */
function box(scroll: { top: number; left: number }) {
  const element = document.createElement('pre');
  element.style.paddingInlineStart = '8px';
  document.body.append(element);
  Object.assign(element, { scrollTop: scroll.top, scrollLeft: scroll.left });
  for (const [name, value] of Object.entries({ clientHeight: 100, clientWidth: 200 })) {
    Object.defineProperty(element, name, { value });
  }
  element.getBoundingClientRect = () => new DOMRect(0, 0, 200, 100);
  element.scrollTo = vi.fn() as typeof element.scrollTo;
  return element;
}

/** A target inside the box with the rectangle it has on the screen. */
function target(parent: HTMLElement, x: number, y: number, width = 40, height = 20) {
  const element = document.createElement('mark');
  parent.append(element);
  element.getBoundingClientRect = () => new DOMRect(x, y, width, height);
  return element;
}

describe('scrollToShow', () => {
  afterEach(() => document.body.replaceChildren());

  it('leaves the box as it is while the target is in view', () => {
    const pre = box({ top: 0, left: 0 });
    scrollToShow(pre, target(pre, 20, 30), true);

    expect(pre.scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls down to a target below, a line of context above it', () => {
    const pre = box({ top: 0, left: 0 });
    scrollToShow(pre, target(pre, 20, 300), false);

    expect(pre.scrollTo).toHaveBeenCalledWith({ top: 280, left: 0, behavior: 'instant' });
  });

  it('scrolls back up to a target above, and sideways only where it is out of view', () => {
    const pre = box({ top: 500, left: 0 });
    scrollToShow(pre, target(pre, 20, -200), true);

    expect(pre.scrollTo).toHaveBeenCalledWith({ top: 280, left: 0, behavior: 'smooth' });
  });

  it('scrolls sideways to a target past the end, its start after the box’s padding', () => {
    const pre = box({ top: 0, left: 0 });
    scrollToShow(pre, target(pre, 400, 30), false);

    expect(pre.scrollTo).toHaveBeenCalledWith({ top: 0, left: 392, behavior: 'instant' });
  });
});
