import { TestBed } from '@angular/core/testing';
import { Packing } from './1-packing.example';
import { FitAll } from './2-fit-all.example';

/** A ResizeObserver that reports a box of one fixed size as soon as it observes something. */
class FixedResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    const entry = { target, contentRect: { width: 700, height: 384 } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }

  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('the tile grid examples', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', FixedResizeObserver));
  afterEach(() => vi.unstubAllGlobals());

  it('show the tiles the grid reports fit, and repack when the tile width changes', async () => {
    const fixture = TestBed.createComponent(Packing);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const summary = () => host.querySelector('[aria-live="polite"]')?.textContent;
    const tiles = () => host.querySelectorAll('neat-video-tile').length;

    // 240 px wide, 8 px apart, in a box of 700 by 384: two columns of two rows.
    expect(summary()).toBe('2 × 2 = 4 per page of 48, gap 8 px');
    expect(tiles()).toBe(4);

    const thumb = host.querySelector('[role="slider"]') as HTMLElement;
    thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await fixture.whenStable();

    expect(host.textContent).toContain('120 px');
    expect(summary()).toMatch(/^5 × 5 = 25 per page of 48/);
    expect(tiles()).toBe(25);
  });

  it('widen the tiles to the widest at which all of them fit, from Fit all', async () => {
    const fixture = TestBed.createComponent(FitAll);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const summary = () => host.querySelector('[aria-live="polite"]')?.textContent;

    // 240 px wide in a box of 700 by 384: only four of the twelve fit.
    expect(summary()).toBe('4 of 12 tiles on the page, 2 × 2');
    (host.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();

    // Four columns of three rows at 169 px: 700 less three gaps, over four.
    expect(host.textContent).toContain('169 px');
    expect(summary()).toBe('12 of 12 tiles on the page, 4 × 3');
    expect(host.querySelectorAll('neat-video-tile').length).toBe(12);
  });
});
