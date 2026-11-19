/*
 * The one rule for the color an overlay draws an item in, by its type: the strategies draw with
 * it, and the tile's `colorOf` reads it back for an app's list beside the video.
 */
import { ɵclassStyles as classStyles } from '@sima/neat-ui';
import type { ColorAllocator, ColorNamespace } from './colors';
import { heldColor, resolveColor } from './colors';
import type { NeatOverlayClassStyle, NeatOverlaySettings } from './overlay-settings';

/** An overlay type the tile draws, as a metadata message's `type` names it. */
export type NeatOverlayType = keyof NeatOverlaySettings['types'];

/**
 * An item of an overlay's message, by what its color goes by: its `id` and its `label`.
 *
 * A track, a detection or a pose from the message fits as it is. So does an app's own row with
 * the same fields, such as `{ id: 7 }` for a track or `{ label: 'car' }` for a detection.
 */
export interface NeatOverlayIdentity {
  /** The track's or the pose's id. */
  readonly id?: unknown;
  /** The class label of a detection, a segment or a classification; a pose's label (`hand`). */
  readonly label?: unknown;
}

interface ColorRule {
  /** Where the allocator keeps the colors: the page's classes, or the tile's tracks or poses. */
  readonly namespace: ColorNamespace;
  /** The field the color goes by. A style row always goes by the label. */
  readonly by: 'id' | 'label';
  /** The type's style rows, for a type that has them. */
  readonly rows?: (settings: NeatOverlaySettings) => readonly NeatOverlayClassStyle[];
}

const RULES: Readonly<Record<NeatOverlayType, ColorRule>> = {
  'object-detection': {
    namespace: 'class',
    by: 'label',
    rows: (settings) => settings.types['object-detection'].objects,
  },
  segmentation: {
    namespace: 'class',
    by: 'label',
    rows: (settings) => settings.types.segmentation.objects,
  },
  classification: { namespace: 'class', by: 'label' },
  tracking: { namespace: 'track', by: 'id' },
  'pose-estimation': {
    namespace: 'pose',
    by: 'id',
    rows: (settings) => settings.types['pose-estimation'].objects,
  },
};

function queryOf(
  allocator: ColorAllocator,
  channel: number,
  type: NeatOverlayType,
  item: NeatOverlayIdentity,
  overrides: Readonly<Record<string, string>> | undefined,
) {
  const { namespace, by } = RULES[type];
  return {
    allocator,
    channelIndex: channel,
    namespace,
    identity: item[by],
    label: item.label,
    overrides,
  };
}

/**
 * The color to draw `item` of `type` in, recording that it was drawn at `now`: its label's style
 * row (`overrides`, from the type's rows), else the color of its identity.
 */
export function resolveItemColor(
  allocator: ColorAllocator,
  channel: number,
  type: NeatOverlayType,
  item: NeatOverlayIdentity,
  overrides: Readonly<Record<string, string>> | undefined,
  now: number,
): string {
  return resolveColor({ ...queryOf(allocator, channel, type, item, overrides), now });
}

/**
 * The color `resolveItemColor` gives `item` with the type's rows in `settings`, without recording
 * a draw; null while its identity holds no color. A computed or a template that calls it follows
 * the colors as they are given and taken back.
 */
export function heldItemColor(
  allocator: ColorAllocator,
  channel: number,
  settings: NeatOverlaySettings,
  type: NeatOverlayType,
  item: NeatOverlayIdentity,
): string | null {
  const { overrides } = classStyles(RULES[type].rows?.(settings) ?? []);
  return heldColor(queryOf(allocator, channel, type, item, overrides));
}
