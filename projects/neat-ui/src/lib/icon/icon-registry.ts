import type { LucideIconData, LucideIconNode } from '@lucide/angular';
import {
  Activity,
  ArrowDown,
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
  Copy,
  Cpu,
  Ellipsis,
  Expand,
  File,
  FileText,
  Folder,
  FolderOpen,
  House,
  Info,
  LayoutGrid,
  LoaderCircle,
  Maximize,
  Maximize2,
  Mic,
  Minimize,
  Minus,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Pause,
  Play,
  Plus,
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
  VideoOff,
  X,
} from 'lucide';
import type { IconNode } from 'lucide';

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

/**
 * A glyph drawn filled with the text color. Media controls are the one place the kit fills an
 * icon: play, pause and stop are solid shapes by convention (a player's transport reads as solid
 * whatever its size), while every other glyph is an outline, so nothing else uses this.
 */
function filled(name: string, node: LucideIconNode[]): LucideIconData {
  return drawing(
    name,
    node.map(([tag, attrs]): LucideIconNode => [tag, { ...attrs, fill: 'currentColor' }]),
  );
}

export const NEAT_ICONS = {
  home: drawing('home', House),
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
  'expand-window': drawing('expand-window', Expand),
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
  copy: drawing('copy', Copy),
  expand: drawing('expand', ChevronDown),
  collapse: drawing('collapse', ChevronUp),
  latest: drawing('latest', ArrowDown),
  minus: drawing('minus', Minus),
  plus: drawing('plus', Plus),
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
  spinner: drawing('spinner', LoaderCircle),
  terminal: drawing('terminal', SquareTerminal),
  'video-off': drawing('video-off', VideoOff),
  pause: filled('pause', Pause),
  play: filled('play', Play),
  stop: filled('stop', Square),
} satisfies Record<string, LucideIconData>;

/** The name of a glyph in the kit's curated icon set, what `neat-icon`'s `name` takes. */
export type NeatIconName = keyof typeof NEAT_ICONS;

/**
 * A Lucide drawing (what `@sima/neat-ui/lucide` exports for each glyph), what `neat-icon`'s `name`
 * takes where no name of the kit's set fits.
 */
export type NeatIconGlyph = IconNode;

/**
 * Every name in the registry, in registry order, for galleries and pickers. Play, pause and stop
 * are the only filled glyphs, since media controls are solid by convention; every other name is an
 * outline.
 */
export const NEAT_ICON_NAMES: readonly NeatIconName[] = Object.keys(NEAT_ICONS) as NeatIconName[];
