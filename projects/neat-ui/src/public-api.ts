/*
 * Public API surface of @sima/neat-ui: the shell and what every page needs. Every other component
 * has its own entry point (@sima/neat-ui/<name>), so an app's main bundle carries only what its
 * shell uses. Every export added here is a promise to consumers.
 */
export type { ColorScale, ColorStep, SurfaceScale } from './lib/theme/color-scale';
export {
  buildColorScale,
  buildNeutralSurfaceScale,
  buildSurfaceScale,
} from './lib/theme/color-scale';
export { contrastRatio } from './lib/theme/color';
export {
  NEAT_DANGER_BASE,
  NEAT_HIGHLIGHT_BASE,
  NEAT_NEAR_BLACK,
  NEAT_PRIMARY_BASE,
  NEAT_SERIES_TEAL_BASE,
  NEAT_WARN_BASE,
  SIMA_PALETTE,
} from './lib/theme/palette';
export type { NeatTone } from './lib/theme/tone';
export { provideNeatUi } from './lib/theme/provide-neat-ui';
export type { NeatColorScheme } from './lib/theme/theme.service';
export { ThemeService } from './lib/theme/theme.service';
export { NeatIcon } from './lib/icon/icon';
export type { NeatIconName } from './lib/icon/icon-registry';
export { NEAT_ICON_NAMES } from './lib/icon/icon-registry';
export type { NeatNavItem } from './lib/shell/nav-item';
export { NeatShell } from './lib/shell/shell';
export { NeatRailDivider, NeatRailItem } from './lib/shell/rail-item';
export { NeatPageToolbar } from './lib/shell/page-toolbar';
export { NeatPage } from './lib/page/page';
export { NeatPageTab, NeatPageTabs } from './lib/page/page-tabs';
export type { NeatAsideOpen } from './lib/page/aside-open';
export { neatAsideOpen } from './lib/page/aside-open';
export { NeatViewport } from './lib/page/viewport';
export {
  NeatAsideActions,
  NeatAsideHeading,
  NeatAsidePanel,
  NeatAsideTitle,
  NeatAsideToggle,
  NeatCode,
} from './lib/page/aside';
export { KIOSK_POINTER_IDLE_MS, KioskService } from './lib/kiosk/kiosk.service';
export type { NeatButtonSize, NeatButtonVariant } from './lib/button/button';
export { NeatButton } from './lib/button/button';
export { NeatInlineButton } from './lib/button/inline-button';
export { NeatLiveDot } from './lib/live-dot/live-dot';
export { NeatNote } from './lib/note/note';
export { neatSecondsAgo } from './lib/time/seconds-ago';
export type { NeatTooltipPosition } from './lib/tooltip/tooltip';
export { NeatTooltip } from './lib/tooltip/tooltip';

/*
 * Not for apps. The `ɵ` exports are what the kit's secondary entry points share with this one:
 * ng-packagr gives each entry the built primary and nothing else, so the vendored helm code in
 * `lib/ui/` (never exported otherwise), the shell's toolbar token and the field label's classes
 * (which `select` and `field` share) reach them only through here.
 * Angular marks its own private API the same way; these may change or go in any release.
 */
export { FIELD_LABEL_CLASSES as ɵFIELD_LABEL_CLASSES } from './lib/form/field-label';
export { IN_PAGE_TOOLBAR as ɵIN_PAGE_TOOLBAR } from './lib/shell/page-toolbar';
export { listVariants as ɵlistVariants } from './lib/ui/tabs/src';
export { hlm as ɵhlm } from './lib/ui/utils/src';
