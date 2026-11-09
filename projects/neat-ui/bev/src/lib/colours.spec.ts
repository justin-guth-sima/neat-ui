import { TestBed } from '@angular/core/testing';
import {
  ɵcreateColorAllocator as createColorAllocator,
  ɵNeatOverlayColors as NeatOverlayColors,
} from '@sima/neat-ui';
import { colorProbe } from '../../../src/lib/theme/theme-colors';
import { dashOf, LabelColours, LINE_WIDTH } from './colours';

describe('LabelColours', () => {
  let page: NeatOverlayColors;

  beforeEach(() => {
    // jsdom has no canvas to resolve colours on: the grids' numbers stay null here.
    colorProbe.context = null;
    page = TestBed.inject(NeatOverlayColors);
  });

  afterEach(() => {
    colorProbe.context = undefined;
  });

  it('gives a label the colour the video tiles give its class on the same page', () => {
    const tile = createColorAllocator(page);
    const truck = tile.colorFor(0, 'class', 'truck', 100);
    const colours = new LabelColours(page);
    colours.begin(200);
    expect(colours.of('car').colour).not.toBe(truck);
    expect(colours.of('truck').colour).toBe(truck);
    // And the other way round: a tile meeting "car" later gets the BEV's colour for it.
    expect(tile.colorFor(3, 'class', 'car', 300)).toBe(colours.of('car').colour);
  });

  it('lets a style row win, for colour, line and width, and a default row cover the rest', () => {
    const colours = new LabelColours(page);
    colours.setStyles([
      { label: 'car', color: '#123456', style: 'dashed', width: 3 },
      { label: 'default', color: '#abcdef', style: 'dotted', width: 1 },
    ]);
    colours.begin(0);
    expect(colours.of('car')).toMatchObject({ colour: '#123456', style: 'dashed', width: 3 });
    expect(colours.of('bus')).toMatchObject({ colour: '#abcdef', style: 'dotted', width: 1 });
  });

  it('uses the plain line width without a row', () => {
    const colours = new LabelColours(page);
    colours.begin(0);
    expect(colours.of('car')).toMatchObject({ style: null, width: LINE_WIDTH });
  });

  it('forgets the rows when they change', () => {
    const colours = new LabelColours(page);
    colours.setStyles([{ label: 'car', color: '#123456', style: 'solid', width: 1 }]);
    colours.begin(0);
    expect(colours.of('car').colour).toBe('#123456');
    colours.setStyles([]);
    colours.begin(1);
    expect(colours.of('car').colour).not.toBe('#123456');
  });

  it('reuses one look per label, so a frame allocates none for labels seen before', () => {
    const colours = new LabelColours(page);
    colours.begin(0);
    const first = colours.of('car');
    colours.begin(16);
    expect(colours.of('car')).toBe(first);
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
