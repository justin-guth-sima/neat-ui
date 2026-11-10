import { TestBed } from '@angular/core/testing';
import { DetectorLevel } from './1-detector-level.example';

/** jsdom has no ResizeObserver; this spec checks what the diagram draws and opens, not sizes. */
class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('the drill-down examples', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', NoopResizeObserver));
  afterEach(() => vi.unstubAllGlobals());

  it('open the Detector on the level neatDrillDownLevel placed', async () => {
    const fixture = TestBed.createComponent(DetectorLevel);
    await fixture.whenStable();
    const diagram = (fixture.nativeElement as HTMLElement).querySelector('neat-diagram')!;
    const blocks = () =>
      Array.from(diagram.querySelectorAll<HTMLElement>('.block'), (b) => b.dataset['node']).sort();

    expect(blocks()).toEqual(['camera', 'detector', 'tracker']);
    diagram.querySelector<HTMLElement>('button[aria-label="Open Detector"]')!.click();
    await fixture.whenStable();

    // Its steps inside a group, what feeds it on the left, what it feeds on the right.
    expect(blocks()).toEqual(['camera', 'nms', 'resize', 'tracker', 'yolox']);
    expect(diagram.querySelector('.group[data-node="detector"]')).not.toBeNull();
    expect(diagram.querySelector('neat-breadcrumbs li')?.textContent).toContain('Detector');
    expect(diagram.querySelector('button[aria-label="Back to Overview"]')).not.toBeNull();
  });
});
