import { TestBed } from '@angular/core/testing';
import { TestPatternTiles } from './1-test-pattern-tiles.example';
import { TestPatternSource } from './test-pattern-source';

async function render() {
  const fixture = TestBed.createComponent(TestPatternTiles);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const toggle = (name: string) =>
    Array.from(host.querySelectorAll<HTMLElement>('button[role="switch"]')).find((b) =>
      b.textContent?.includes(name),
    )!;
  const tiles = () => Array.from(host.querySelectorAll<HTMLElement>('neat-video-tile'));
  return { fixture, host, toggle, tiles };
}

describe('the video tile examples', () => {
  it('show both tiles’ bars and the empty one’s no-video note, until Bars is off', async () => {
    const { fixture, toggle, tiles } = await render();

    expect(tiles().map((tile) => tile.querySelector('.bar .label')?.textContent)).toEqual([
      '1',
      '2',
    ]);
    // Without canvas capture (jsdom) the first tile has no stream either, so both are empty.
    expect(tiles()[1].querySelector('.no-video')?.textContent).toContain(
      'No active video received',
    );

    toggle('Bars').click();
    await fixture.whenStable();

    expect(tiles().map((tile) => tile.querySelector('.bar'))).toEqual([null, null]);
    expect(tiles()[1].querySelector('.no-video')).toBeNull();
  });

  it('mark the first tile selected from Selected', async () => {
    const { fixture, toggle, tiles } = await render();

    expect(tiles()[0].hasAttribute('data-selected')).toBe(false);
    toggle('Selected').click();
    await fixture.whenStable();

    expect(tiles()[0].hasAttribute('data-selected')).toBe(true);
    expect(tiles()[1].hasAttribute('data-selected')).toBe(false);
  });

  it('say the first tile’s state, and pause its source from Pause the source', async () => {
    const setPaused = vi.spyOn(TestPatternSource.prototype, 'setPaused');
    const { fixture, host, toggle } = await render();

    expect(host.querySelector('[aria-live="polite"]')?.textContent).toBe('First tile: empty');
    toggle('Pause the source').click();
    await fixture.whenStable();
    expect(setPaused).toHaveBeenLastCalledWith(true);
    toggle('Pause the source').click();
    await fixture.whenStable();
    expect(setPaused).toHaveBeenLastCalledWith(false);

    vi.restoreAllMocks();
  });
});
