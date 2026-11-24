import { TestBed } from '@angular/core/testing';
import { TestPatternTiles } from './1-test-pattern-tiles.example';
import { Notice } from './3-notice.example';
import { ExpandingATile } from './5-expanding-a-tile.example';
import { RotatedBoxes } from './6-rotated-boxes.example';
import { rotatedShip } from './rotated-box-source';
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

describe('the notice example', () => {
  it('says "No signal" on the tile without a stream, and the first tile’s trouble once switched on', async () => {
    const fixture = TestBed.createComponent(Notice);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const notes = () =>
      Array.from(host.querySelectorAll('neat-video-tile'), (tile) =>
        tile.querySelector('.no-video')?.textContent?.trim(),
      );

    // Without canvas capture (jsdom) the first tile has no stream either, so it says it centered.
    expect(notes()).toEqual([undefined, 'No signal']);
    expect(host.querySelector('.bar'), 'no bars').toBeNull();

    host.querySelector<HTMLElement>('button[role="switch"]')!.click();
    await fixture.whenStable();
    expect(notes()).toEqual(['Inference stopped', 'No signal']);
  });
});

describe('the expanding example', () => {
  it('expands the tile from its own button and from the app’s, and puts it back on Escape', async () => {
    const fixture = TestBed.createComponent(ExpandingATile);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const tile = host.querySelector<HTMLElement>('neat-video-tile')!;
    const control = tile.querySelector<HTMLButtonElement>('button.expand')!;

    expect(control.getAttribute('aria-label')).toBe('Expand Camera 1');
    control.click();
    await fixture.whenStable();
    expect(tile.hasAttribute('data-neat-expanded')).toBe(true);
    expect(control.getAttribute('aria-label')).toBe('Close');

    control.click();
    await fixture.whenStable();
    host.querySelector<HTMLButtonElement>('.showcase-row button')!.click();
    await fixture.whenStable();
    expect(tile.hasAttribute('data-neat-expanded')).toBe(true);

    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(tile.hasAttribute('data-neat-expanded')).toBe(false);
  });
});

describe('the rotated boxes example', () => {
  it('renders a tile that Mirror flips', async () => {
    const fixture = TestBed.createComponent(RotatedBoxes);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const tile = host.querySelector<HTMLElement>('neat-video-tile')!;

    expect(tile.hasAttribute('data-mirrored')).toBe(false);
    host.querySelector<HTMLElement>('button[role="switch"]')!.click();
    await fixture.whenStable();
    expect(tile.hasAttribute('data-mirrored')).toBe(true);
  });

  it('sends a ship whose bbox is the upright extent of its oriented_bbox', () => {
    for (const frame of [0, 20, 40, 79, 150]) {
      const { bbox, oriented_bbox: [cx, cy, w, h, angle] } = rotatedShip(frame);
      expect(angle).toBeCloseTo(frame * 0.02, 12);
      expect(bbox[0] + bbox[2] / 2).toBeCloseTo(cx, 9);
      expect(bbox[1] + bbox[3] / 2).toBeCloseTo(cy, 9);
      expect(bbox[2]).toBeGreaterThanOrEqual(Math.min(w, h));
    }
    expect(rotatedShip(0).bbox).toEqual([210, 135, 220, 90]);
  });
});
