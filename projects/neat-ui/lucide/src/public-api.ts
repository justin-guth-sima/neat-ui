/**
 * Every glyph of Lucide, for `neat-icon` to draw: `<neat-icon [name]="Rocket" />` with
 * `import { Rocket } from '@sima/neat-ui/lucide'`. Use a name of the kit's own set first
 * (`NEAT_ICON_NAMES`) and a glyph from here only where no name fits.
 *
 * A secondary entry point, so a glyph reaches an app's bundle only where it is imported (Lucide
 * marks its package side-effect free). Apps import Lucide through this entry and never directly,
 * so the icon library stays swappable in the kit.
 */
export * from 'lucide';
