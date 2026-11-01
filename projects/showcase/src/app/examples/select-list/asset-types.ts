/** An asset type of the checked lists' demos; one has no files, so nothing to check. */
export interface AssetType {
  readonly id: string;
  readonly name: string;
  readonly files: number;
}

export const ASSET_TYPES: readonly AssetType[] = [
  { id: 'cars', name: 'Cars', files: 12 },
  { id: 'people', name: 'People', files: 8 },
  { id: 'drones', name: 'Drones', files: 0 },
  { id: 'boats', name: 'Boats', files: 3 },
  { id: 'trucks', name: 'Trucks', files: 5 },
];

export const typeId = (type: AssetType): string => type.id;

/** Only a type with files has a box. */
export const hasFiles = (type: AssetType): boolean => type.files > 0;
