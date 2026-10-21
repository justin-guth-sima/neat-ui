import {
  LucideActivity,
  LucideCable,
  LucideCpu,
  LucideFolderOpen,
  LucideIcon,
  LucideInfo,
  LucideLayoutGrid,
  LucideMaximize,
  LucideMinimize,
  LucideMoon,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideRadioTower,
  LucideSun,
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
} satisfies Record<string, LucideIcon>;

export type NeatIconName = keyof typeof NEAT_ICONS;
