/*
 * What jsdom lacks that the hosts' parts create: a ResizeObserver (the dot layer, the kit's notes
 * and vflow observe their boxes) and a 2D canvas (the dot layer's colors and sprites). The
 * stand-ins never report a size and give no context, which every part treats as "not laid out
 * yet", so a host renders its DOM and draws nothing. jsdom runs no animation frames either, so
 * vflow never becomes ready here (it would then measure SVG geometry jsdom does not have): what
 * vflow does once ready, the start transform among it, is checked in Chromium.
 */
class SilentResizeObserver {
  observe(): void {
    // Never reports: jsdom lays nothing out.
  }
  unobserve(): void {
    // Nothing observed to forget.
  }
  disconnect(): void {
    // Nothing observed to forget.
  }
}

/** Puts the stand-ins in place (undone by `vi.unstubAllGlobals` and `vi.restoreAllMocks`). */
export function stubLayout(): void {
  vi.stubGlobal('ResizeObserver', SilentResizeObserver);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
}

/** Gives every element a box of `w` × `h` px, as a browser would after layout. */
export function stubBoxSize(w: number, h: number): void {
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(w);
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(h);
}
