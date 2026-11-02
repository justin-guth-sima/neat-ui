import { TestBed } from '@angular/core/testing';
import { NEAT_ICON_NAMES } from '@sima/neat-ui';
import { Gallery } from './1-gallery.example';
import { SizesAndLabels } from './2-sizes-and-labels.example';
import { AnyLucideGlyph } from './3-any-lucide-glyph.example';

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

  it('draw three glyphs outside the kit’s set at each size, each an image named for it', async () => {
    const fixture = TestBed.createComponent(AnyLucideGlyph);
    await fixture.whenStable();
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.showcase-row'),
    );

    expect(
      rows.map((row) => Array.from(row.querySelectorAll('svg'), (s) => s.getAttribute('width'))),
    ).toEqual(Array(3).fill(['16', '20', '24']));
    expect(rows.map((row) => row.querySelector('svg')?.getAttribute('aria-label'))).toEqual([
      'Rocket',
      'Anchor',
      'Bell',
    ]);
    expect(new Set(rows.map((row) => row.querySelector('svg')?.innerHTML)).size).toBe(3);
  });
});
