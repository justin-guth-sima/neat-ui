/*
 * The page's class colors, which the overlays draw with: they live in the primary entry, since
 * the bird's-eye view (`bev`) colors its labels from them too, so a class has one color in every
 * tile and in the view. Re-exported here under their own names for the overlays' code.
 */
export {
  ɵcreateColorAllocator as createColorAllocator,
  ɵheldColor as heldColor,
  ɵNeatOverlayColors as NeatOverlayColors,
  ɵresolveColor as resolveColor,
} from '@sima/neat-ui';
export type {
  ɵColorAllocator as ColorAllocator,
  ɵColorNamespace as ColorNamespace,
} from '@sima/neat-ui';
