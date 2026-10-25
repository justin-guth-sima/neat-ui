import type { LucideIconData, LucideIconNode } from '@lucide/angular';
import {
  Activity,
  Blocks,
  Cable,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircuitBoard,
  Cpu,
  Ellipsis,
  File,
  FileText,
  Folder,
  FolderOpen,
  Info,
  LayoutGrid,
  Maximize,
  Maximize2,
  Mic,
  Minimize,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Pause,
  Play,
  Radar,
  RadioTower,
  RectangleHorizontal,
  RefreshCw,
  Search,
  Shapes,
  Square,
  SquareTerminal,
  Sun,
  TriangleAlert,
  Upload,
  X,
} from 'lucide';

/**
 * The kit's icon vocabulary: names say what an icon means in the app, the value is the Lucide
 * drawing that draws it. This is the only file that references Lucide glyphs, so a glyph is
 * swapped in one place.
 *
 * Why drawings (the plain node arrays of the `lucide` package) and not the `@lucide/angular`
 * component of each glyph: every such component carries its own compiled copy of the shared SVG
 * template (about 3 kB), a drawing is about 150 bytes, and `LucideDynamicIcon` draws either.
 */
function drawing(name: string, node: LucideIconNode[]): LucideIconData {
  return { name, node };
}

export const NEAT_ICONS = {
  media: drawing('media', FolderOpen),
  streaming: drawing('streaming', RadioTower),
  viewer: drawing('viewer', LayoutGrid),
  peripherals: drawing('peripherals', Cable),
  camera: drawing('camera', Camera),
  microphone: drawing('microphone', Mic),
  lidar: drawing('lidar', Radar),
  device: drawing('device', CircuitBoard),
  stats: drawing('stats', Activity),
  board: drawing('board', Cpu),
  info: drawing('info', Info),
  sun: drawing('sun', Sun),
  moon: drawing('moon', Moon),
  'kiosk-enter': drawing('kiosk-enter', Maximize),
  'kiosk-exit': drawing('kiosk-exit', Minimize),
  'rail-expand': drawing('rail-expand', PanelLeftOpen),
  'rail-collapse': drawing('rail-collapse', PanelLeftClose),
  'side-panel': drawing('side-panel', PanelRight),
  palette: drawing('palette', Palette),
  shapes: drawing('shapes', Shapes),
  blocks: drawing('blocks', Blocks),
  document: drawing('document', FileText),
  previous: drawing('previous', ChevronLeft),
  next: drawing('next', ChevronRight),
  close: drawing('close', X),
  check: drawing('check', Check),
  expand: drawing('expand', ChevronDown),
  collapse: drawing('collapse', ChevronUp),
  'aspect-wide': drawing('aspect-wide', RectangleHorizontal),
  'aspect-square': drawing('aspect-square', Square),
  search: drawing('search', Search),
  more: drawing('more', Ellipsis),
  'fit-all': drawing('fit-all', Maximize2),
  upload: drawing('upload', Upload),
  folder: drawing('folder', Folder),
  file: drawing('file', File),
  error: drawing('error', CircleAlert),
  warning: drawing('warning', TriangleAlert),
  refresh: drawing('refresh', RefreshCw),
  terminal: drawing('terminal', SquareTerminal),
  pause: drawing('pause', Pause),
  play: drawing('play', Play),
} satisfies Record<string, LucideIconData>;

export type NeatIconName = keyof typeof NEAT_ICONS;

/** Every name in the registry, in registry order, for galleries and pickers. */
export const NEAT_ICON_NAMES: readonly NeatIconName[] = Object.keys(NEAT_ICONS) as NeatIconName[];
