import {
  LucideActivity,
  LucideBlocks,
  LucideCable,
  LucideCheck,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideChevronUp,
  LucideCpu,
  LucideEllipsis,
  LucideFileText,
  LucideFolderOpen,
  LucideIcon,
  LucideInfo,
  LucideLayoutGrid,
  LucideMaximize,
  LucideMaximize2,
  LucideMinimize,
  LucideMoon,
  LucidePalette,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideRadioTower,
  LucideRectangleHorizontal,
  LucideSearch,
  LucideShapes,
  LucideSquare,
  LucideSun,
  LucideUpload,
  LucideX,
} from '@lucide/angular';

/**
 * The kit's icon vocabulary: names say what an icon means in the app, the value is the Lucide
 * glyph that draws it. This is the only file that references Lucide glyphs, so a glyph is swapped
 * in one place and only the glyphs listed here end up in an app's bundle.
 */
export const NEAT_ICONS = {
  media: LucideFolderOpen,
  streaming: LucideRadioTower,
  viewer: LucideLayoutGrid,
  peripherals: LucideCable,
  stats: LucideActivity,
  board: LucideCpu,
  info: LucideInfo,
  sun: LucideSun,
  moon: LucideMoon,
  'kiosk-enter': LucideMaximize,
  'kiosk-exit': LucideMinimize,
  'rail-expand': LucidePanelLeftOpen,
  'rail-collapse': LucidePanelLeftClose,
  palette: LucidePalette,
  shapes: LucideShapes,
  blocks: LucideBlocks,
  document: LucideFileText,
  previous: LucideChevronLeft,
  next: LucideChevronRight,
  close: LucideX,
  check: LucideCheck,
  expand: LucideChevronDown,
  collapse: LucideChevronUp,
  'aspect-wide': LucideRectangleHorizontal,
  'aspect-square': LucideSquare,
  search: LucideSearch,
  more: LucideEllipsis,
  'fit-all': LucideMaximize2,
  upload: LucideUpload,
} satisfies Record<string, LucideIcon>;

export type NeatIconName = keyof typeof NEAT_ICONS;

/** Every name in the registry, in registry order, for galleries and pickers. */
export const NEAT_ICON_NAMES: readonly NeatIconName[] = Object.keys(NEAT_ICONS) as NeatIconName[];
