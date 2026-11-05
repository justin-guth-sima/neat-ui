import { resize, stubResizeObserver, watched } from './resize-observer.testing';
import { textWidth, watchWidth } from './strip-measure';

describe('watchWidth', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports the width now and at every resize, until stopped', () => {
    stubResizeObserver();
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({ width: 480 }) as DOMRect;
    const widths: number[] = [];

    const stop = watchWidth(element, (width) => widths.push(width));
    resize(element, 520);
    expect(widths).toEqual([480, 520]);
    expect(watched()).toEqual([element]);

    stop();
    expect(watched()).toEqual([]);
  });

  it('reports the width again once the fonts have loaded, unless stopped by then', async () => {
    stubResizeObserver();
    let loaded!: () => void;
    const ready = new Promise<void>((resolve) => (loaded = resolve));
    // jsdom has no font loading: stand in the document's font set for the one test.
    Object.defineProperty(document, 'fonts', { value: { ready }, configurable: true });
    onTestFinished(() => {
      delete (document as { fonts?: unknown }).fonts;
    });
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({ width: 480 }) as DOMRect;
    const widths: number[] = [];
    const stopped: number[] = [];

    watchWidth(element, (width) => widths.push(width));
    watchWidth(element, (width) => stopped.push(width))();
    loaded();
    await ready;

    expect(widths).toEqual([480, 480]);
    expect(stopped).toEqual([480]);
  });

  it('reports the width once where there is no ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({ width: 300 }) as DOMRect;
    const widths: number[] = [];

    const stop = watchWidth(element, (width) => widths.push(width));

    expect(widths).toEqual([300]);
    expect(stop).not.toThrow();
  });
});

describe('textWidth', () => {
  it('is the width of the probe holding the text, as the probe’s styles draw it', () => {
    const probe = document.createElement('span');
    probe.getBoundingClientRect = () => ({ width: probe.textContent!.length * 7 }) as DOMRect;

    expect(textWidth(probe, 'Zoom in')).toBe(49);
    expect(textWidth(probe, 'Throw up')).toBe(56);
  });
});
