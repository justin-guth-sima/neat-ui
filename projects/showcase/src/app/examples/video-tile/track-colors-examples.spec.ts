import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { type NeatTileFrameListener, NeatVideoTile } from '@sima/neat-ui/video';
import { TrackColors } from './4-track-colors.example';
import { roadTracks } from './track-source';

describe('the track colors example', () => {
  afterEach(() => vi.restoreAllMocks());

  async function render() {
    const fixture = TestBed.createComponent(TrackColors);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const tile = fixture.debugElement.query(By.directive(NeatVideoTile))
      .componentInstance as NeatVideoTile;
    const listener = tile.frameListener() as NeatTileFrameListener;
    const show = async (frame: number) => {
      const message = { type: 'tracking', data: { tracks: roadTracks(frame) } };
      listener({ now: frame, messages: [{ message, held: false }] });
      await fixture.whenStable();
    };
    const rows = () =>
      Array.from(element.querySelectorAll('tbody tr')).map((row) =>
        Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
      );
    return { element, show, rows };
  }

  it('lists the tracks of the frame the tile presents, by id', async () => {
    const { element, show, rows } = await render();
    expect(element.querySelector('[neatNote]')?.textContent).toContain('Nothing tracked');

    await show(0);
    const expected = [...roadTracks(0)]
      .sort((a, b) => a.id - b.id)
      .map(({ id, label }) => [`#${id}`, label]);
    expect(rows()).toEqual(expected);
  });

  it('gives each row a swatch in the color the tile drew its track in', async () => {
    const [first] = roadTracks(0);
    const colorOf = vi
      .spyOn(NeatVideoTile.prototype, 'colorOf')
      .mockImplementation((_, item) => (item.id === first.id ? 'rgb(1 2 3)' : null));
    const { element, show } = await render();

    await show(0);
    expect(colorOf).toHaveBeenCalledWith('tracking', expect.objectContaining({ id: first.id }));
    const swatches = Array.from(element.querySelectorAll<HTMLElement>('neat-swatch'));
    expect(swatches.map((swatch) => swatch.style.getPropertyValue('--swatch'))).toEqual([
      'rgb(1 2 3)',
    ]);
  });

  it('makes a vehicle that drives on a new track, with the next id', () => {
    const ids = (frame: number) => roadTracks(frame).map(({ id }) => id);
    expect(ids(0)).toEqual([1, 2, 3, 4]);
    const later = Array.from({ length: 400 }, (_, frame) => ids(frame)).flat();
    expect(Math.max(...later)).toBeGreaterThan(4);
    for (const { bbox } of roadTracks(100)) {
      expect(bbox[0] + bbox[2], 'only vehicles on screen').toBeGreaterThan(0);
      expect(bbox[0]).toBeLessThan(640);
    }
  });
});
