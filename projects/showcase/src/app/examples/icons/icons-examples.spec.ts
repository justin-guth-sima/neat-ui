import { TestBed } from '@angular/core/testing';
import { NEAT_ICON_NAMES } from '@sima/neat-ui';
import { Gallery } from './1-gallery.example';
import { SizesAndLabels } from './2-sizes-and-labels.example';

describe('the icon examples', () => {
  it('draw every name of the set once, labelled with it', async () => {
    const fixture = TestBed.createComponent(Gallery);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(
      Array.from(host.querySelectorAll('.icon-card'), (card) => card.textContent?.trim()),
    ).toEqual([...NEAT_ICON_NAMES]);
    expect(host.querySelectorAll('.icon-card neat-icon')).toHaveLength(NEAT_ICON_NAMES.length);
  });

  it('draw each size twice, decorative without a label and an image with one', async () => {
    const fixture = TestBed.createComponent(SizesAndLabels);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const rows = Array.from(host.querySelectorAll('.showcase-row'));
    const sizes = (row: Element): string[] =>
      Array.from(row.querySelectorAll('svg'), (svg) => svg.getAttribute('width') ?? '');

    expect(rows.map(sizes)).toEqual([
      ['16', '20', '24'],
      ['16', '20', '24'],
    ]);
    expect(rows[0].querySelectorAll('[role="img"]')).toHaveLength(0);
    expect(
      Array.from(rows[1].querySelectorAll('[role="img"]'), (svg) => svg.getAttribute('aria-label')),
    ).toEqual(['Board', 'Board', 'Board']);
  });
});
