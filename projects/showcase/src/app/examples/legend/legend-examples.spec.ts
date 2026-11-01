import { TestBed } from '@angular/core/testing';
import { EdgeColours } from './1-edge-colours.example';

describe('the legend examples', () => {
  it('list the entries as a Legend, a swatch or a line sample before each label', async () => {
    const fixture = TestBed.createComponent(EdgeColours);
    await fixture.whenStable();
    const list = (fixture.nativeElement as HTMLElement).querySelector('ul[aria-label="Legend"]')!;
    const items = Array.from(list.querySelectorAll('li'));

    expect(items.map((li) => li.textContent?.trim())).toEqual([
      'image',
      'results',
      'inside the Detector',
      'not run here',
      'unnamed',
    ]);
    // A series without a line is a swatch; any other entry is a sample of its line.
    expect(items.map((li) => li.querySelector('neat-series-swatch') !== null)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(items.map((li) => li.querySelector('.sample')?.getAttribute('data-line'))).toEqual([
      undefined,
      undefined,
      'dashed',
      'ghost',
      'solid',
    ]);
  });
});
