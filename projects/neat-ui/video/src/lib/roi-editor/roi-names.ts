import type { NeatRoiPolygon } from '../overlays/overlay-settings';

const TYPE_NAMES: Record<NeatRoiPolygon['type'], string> = {
  inclusion: 'Inclusion',
  exclusion: 'Exclusion',
};

/**
 * The name of each region, in the order given: its type, numbered per type in list order
 * ("Inclusion 1", "Exclusion 1", "Exclusion 2", "Inclusion 2"). Every region counts, drawable or
 * not, so an app's region list and `neat-roi-editor`'s Delete bubble name the same region alike.
 */
export function neatRoiNames(regions: readonly NeatRoiPolygon[]): string[] {
  const counts = { inclusion: 0, exclusion: 0 };
  return regions.map((region) => `${TYPE_NAMES[region.type]} ${++counts[region.type]}`);
}
