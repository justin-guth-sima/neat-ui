/*
 * Public API surface of @sima/neat-ui. Every export added here is a promise to consumers.
 */
export type { ColorScale, ColorStep, SurfaceScale } from './lib/theme/color-scale';
export { buildColorScale, buildSurfaceScale } from './lib/theme/color-scale';
export { contrastRatio } from './lib/theme/color';
export {
  NEAT_DANGER_BASE,
  NEAT_PRIMARY_BASE,
  NEAT_WARN_BASE,
  SIMA_PALETTE,
} from './lib/theme/palette';
export { provideNeatUi } from './lib/theme/provide-neat-ui';
export type { NeatColorScheme } from './lib/theme/theme.service';
export { ThemeService } from './lib/theme/theme.service';
export { NeatIcon } from './lib/icon/icon';
export type { NeatIconName } from './lib/icon/icon-registry';
export { NEAT_ICON_NAMES } from './lib/icon/icon-registry';
export type { NeatNavItem } from './lib/shell/nav-item';
export { NeatShell } from './lib/shell/shell';
export { NeatPage } from './lib/page/page';
export { KIOSK_POINTER_IDLE_MS, KioskService } from './lib/kiosk/kiosk.service';
export type { NeatButtonSize, NeatButtonVariant } from './lib/button/button';
export { NeatButton } from './lib/button/button';
export type { NeatTooltipPosition } from './lib/tooltip/tooltip';
export { NeatTooltip } from './lib/tooltip/tooltip';
