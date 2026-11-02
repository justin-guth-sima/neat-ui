import { TestBed } from '@angular/core/testing';
import { NeatVideoTile } from '@sima/neat-ui/video';
import { DrawingRegions } from './1-drawing-regions.example';
import { TestPatternSource } from './test-pattern-source';

async function render() {
  const fixture = TestBed.createComponent(DrawingRegions);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const summary = () => host.querySelector('[aria-live="polite"]')?.textContent;
  const tile = () =>
    fixture.debugElement.query((el) => el.componentInstance instanceof NeatVideoTile)
      .componentInstance as NeatVideoTile;
  return { fixture, host, summary, tile };
}

describe('the ROI editor examples', () => {
  it('start with one exclusion region, drawing inclusion regions', async () => {
    const { host, summary } = await render();

    expect(summary()).toBe('Regions: 1 (0 inclusion, 1 exclusion) · highlighted: none');
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

  it('count the regions by type and name the highlighted one as Delete does', async () => {
    const { fixture, summary } = await render();
    const example = fixture.componentInstance;
    const square = [
      { x: 0.1, y: 0.1 },
      { x: 0.4, y: 0.1 },
      { x: 0.4, y: 0.4 },
    ];

    example['regions'].set([
      { type: 'inclusion', points: square },
      { type: 'exclusion', points: square },
      { type: 'exclusion', points: square },
    ]);
    example['highlighted'].set(2);
    await fixture.whenStable();

    expect(summary()).toBe('Regions: 3 (1 inclusion, 2 exclusion) · highlighted: Exclusion 2');
  });

  describe('the filtering the regions do', () => {
    it('hands the tile the regions with their outline off, so the editor alone draws them', async () => {
      const { fixture, tile } = await render();
      const regions = fixture.componentInstance['regions'];

      expect(tile().settings().roi).toBe(regions());
      expect(tile().settings().general.showRoi).toBe(false);
      expect(tile().settings().general.applyRoiFiltering).toBe(true);

      regions.set([]);
      await fixture.whenStable();

      expect(tile().settings().roi).toEqual([]);
    });

    it('place the starting exclusion region where the box passes, centre height included', async () => {
      const { tile } = await render();
      const [region] = tile().settings().roi;
      const xs = region.points.map((point) => point.x);
      const ys = region.points.map((point) => point.y);

      expect(region.type).toBe('exclusion');
      // The box bounces over the whole width at mid height, so its centre crosses mid-image.
      expect(Math.min(...xs)).toBeLessThan(0.5);
      expect(Math.max(...xs)).toBeGreaterThan(0.5);
      expect(Math.min(...ys)).toBeLessThan(0.5);
      expect(Math.max(...ys)).toBeGreaterThan(0.5);
      // And leaves both ends of the path free, where the box shows.
      expect(Math.min(...xs)).toBeGreaterThan(0.2);
      expect(Math.max(...xs)).toBeLessThan(0.8);
    });

    it('say the rule in a caption', async () => {
      const { host } = await render();

      expect(host.querySelector('.rule')?.textContent).toContain('centre');
      expect(host.querySelector('.rule')?.textContent).toContain('exclusion');
    });
  });
});
