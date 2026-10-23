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
export { NeatPageToolbar } from './lib/shell/page-toolbar';
export { NeatPage } from './lib/page/page';
export { KIOSK_POINTER_IDLE_MS, KioskService } from './lib/kiosk/kiosk.service';
export type { NeatButtonSize, NeatButtonVariant } from './lib/button/button';
export { NeatButton } from './lib/button/button';
export { NeatInlineButton } from './lib/button/inline-button';
export type { NeatTooltipPosition } from './lib/tooltip/tooltip';
export { NeatTooltip } from './lib/tooltip/tooltip';
export { NeatSwitch } from './lib/switch/switch';
export { NeatSlider } from './lib/slider/slider';
export type { NeatSegmentedOption } from './lib/segmented/segmented';
export { NeatSegmented } from './lib/segmented/segmented';
export { NeatLine, NeatLineEnd, NeatLineList } from './lib/line-list/line-list';
export { NeatTab, NeatTabs } from './lib/tabs/tabs';
export type { NeatPopoverAlign } from './lib/popover/popover';
export { NeatPopover, NeatPopoverContent, NeatPopoverTrigger } from './lib/popover/popover';
export type { NeatConfirmOptions } from './lib/confirm/confirm';
export { NeatConfirm } from './lib/confirm/confirm';
export type { NeatInputSize } from './lib/input/input';
export { NeatInput } from './lib/input/input';
export { NeatNumberField } from './lib/number-field/number-field';
