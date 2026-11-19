import { TestBed } from '@angular/core/testing';
import {
  ɵcreateColorAllocator as createColorAllocator,
  ɵNeatOverlayColors as NeatOverlayColors,
} from '@sima/neat-ui';
import { colorProbe } from '../../../src/lib/theme/theme-colors';
import { dashOf, LabelColors, LINE_WIDTH } from './colors';

describe('LabelColors', () => {
  let page: NeatOverlayColors;

  beforeEach(() => {
    // jsdom has no canvas to resolve colors on: the grids' numbers stay null here.
    colorProbe.context = null;
    page = TestBed.inject(NeatOverlayColors);
  });

  afterEach(() => {
    colorProbe.context = undefined;
  });

  it('gives a label the color the video tiles give its class on the same page', () => {
    const tile = createColorAllocator(page);
    const truck = tile.colorFor(0, 'class', 'truck', 100);
    const colors = new LabelColors(page);
    colors.begin(200);
    expect(colors.of('car').color).not.toBe(truck);
    expect(colors.of('truck').color).toBe(truck);
    // And the other way round: a tile meeting "car" later gets the BEV's color for it.
    expect(tile.colorFor(3, 'class', 'car', 300)).toBe(colors.of('car').color);
  });

  it('reads a label’s color back without drawing it: the row’s, else the class color it holds', () => {
    const colors = new LabelColors(page);
    const rows = [{ label: 'car', color: '#123456', style: 'solid', width: 3 } as const];
    expect(colors.heldColorOf('car', rows)).toBe('#123456');
    expect(colors.heldColorOf('truck', rows), 'not drawn yet').toBeNull();
    colors.begin(0);
    const truck = colors.of('truck').color;
    expect(colors.heldColorOf('truck', rows)).toBe(truck);
    expect(colors.heldColorOf('truck', []), 'one class color with the tiles').toBe(
      createColorAllocator(page).colorFor(0, 'class', 'truck', 1),
    );
  });

  it('lets a style row win, for color, line and width, and a default row cover the rest', () => {
    const colors = new LabelColors(page);
    colors.setStyles([
      { label: 'car', color: '#123456', style: 'dashed', width: 3 },
      { label: 'default', color: '#abcdef', style: 'dotted', width: 1 },
    ]);
    colors.begin(0);
    expect(colors.of('car')).toMatchObject({ color: '#123456', style: 'dashed', width: 3 });
    expect(colors.of('bus')).toMatchObject({ color: '#abcdef', style: 'dotted', width: 1 });
  });

  it('uses the plain line width without a row', () => {
    const colors = new LabelColors(page);
    colors.begin(0);
    expect(colors.of('car')).toMatchObject({ style: null, width: LINE_WIDTH });
  });

  it('forgets the rows when they change', () => {
    const colors = new LabelColors(page);
    colors.setStyles([{ label: 'car', color: '#123456', style: 'solid', width: 1 }]);
    colors.begin(0);
    expect(colors.of('car').color).toBe('#123456');
    colors.setStyles([]);
    colors.begin(1);
    expect(colors.of('car').color).not.toBe('#123456');
  });

  it('reuses one look per label, so a frame allocates none for labels seen before', () => {
    const colors = new LabelColors(page);
    colors.begin(0);
    const first = colors.of('car');
    colors.begin(16);
    expect(colors.of('car')).toBe(first);
  });
});

describe('dashOf', () => {
  it('dashes as the video overlays do', () => {
    expect(dashOf('dashed')).toEqual([6, 4]);
    expect(dashOf('dotted')).toEqual([2, 2]);
    expect(dashOf('solid')).toEqual([]);
    expect(dashOf(null)).toEqual([]);
  });
});
