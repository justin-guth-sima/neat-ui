import { TestBed } from '@angular/core/testing';
import { DrawingRegions } from './1-drawing-regions.example';
import { TestPatternSource } from './test-pattern-source';

async function render() {
  const fixture = TestBed.createComponent(DrawingRegions);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const summary = () => host.querySelector('[aria-live="polite"]')?.textContent;
  return { fixture, host, summary };
}

describe('the ROI editor examples', () => {
  it('start with no regions, drawing inclusion regions', async () => {
    const { host, summary } = await render();

    expect(summary()).toBe('Regions: 0 (0 inclusion, 0 exclusion) · highlighted: none');
    expect(
      host.querySelector(
        'neat-segmented [aria-checked="true"], neat-segmented [aria-pressed="true"]',
      )?.textContent,
    ).toContain('Inclusion');
    expect(host.querySelector('neat-video-tile neat-roi-editor')).not.toBeNull();
  });

  it('name the colours of both region types, as the editor draws them', async () => {
    const { host } = await render();
    const keys = Array.from(host.querySelectorAll('.key'));

    expect(keys.map((key) => key.textContent?.trim())).toEqual(['Inclusion', 'Exclusion']);
    expect(keys.map((key) => key.querySelector('neat-roi-swatch') !== null)).toEqual([true, true]);
  });

  it('pause the source from Pause the source', async () => {
    const setPaused = vi.spyOn(TestPatternSource.prototype, 'setPaused');
    const { fixture, host } = await render();
    const pause = Array.from(host.querySelectorAll<HTMLElement>('button[role="switch"]')).find(
      (b) => b.textContent?.includes('Pause the source'),
    )!;

    pause.click();
    await fixture.whenStable();

    expect(setPaused).toHaveBeenLastCalledWith(true);
    vi.restoreAllMocks();
  });
});
