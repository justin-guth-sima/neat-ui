import type { NeatRoiPolygon } from '../overlays/overlay-settings';
import { neatRoiNames } from './roi-names';

const region = (type: NeatRoiPolygon['type'], points = 3): NeatRoiPolygon => ({
  type,
  points: Array.from({ length: points }, (_, i) => ({ x: i / 10, y: 0 })),
});

describe('neatRoiNames', () => {
  it('names each region by its type, numbered per type in list order', () => {
    expect(
      neatRoiNames([
        region('inclusion'),
        region('exclusion'),
        region('exclusion'),
        region('inclusion'),
      ]),
    ).toEqual(['Inclusion 1', 'Exclusion 1', 'Exclusion 2', 'Inclusion 2']);
  });

  it('numbers every region in the list, drawable or not, so a name is the same everywhere', () => {
    expect(neatRoiNames([region('inclusion', 2), region('inclusion')])).toEqual([
      'Inclusion 1',
      'Inclusion 2',
    ]);
  });

  it('names no regions as an empty list', () => {
    expect(neatRoiNames([])).toEqual([]);
  });
});
