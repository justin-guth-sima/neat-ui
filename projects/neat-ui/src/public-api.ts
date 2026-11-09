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
export type { NeatRgb } from './lib/theme/theme-colors';
export { neatResolveColor, neatThemeColors } from './lib/theme/theme-colors';
export { NeatIcon } from './lib/icon/icon';
export type { NeatIconGlyph, NeatIconName } from './lib/icon/icon-registry';
export { NEAT_ICON_NAMES } from './lib/icon/icon-registry';
export type { NeatNavChild, NeatNavItem } from './lib/shell/nav-item';
export { NeatShell } from './lib/shell/shell';
export { NeatRailDivider, NeatRailItem } from './lib/shell/rail-item';
export { provideNeatTitles } from './lib/shell/titles';
export { NeatPageToolbar } from './lib/shell/page-toolbar';
export { NeatPage } from './lib/page/page';
export type { NeatPageNavGroup, NeatPageNavLink } from './lib/page/page-nav';
export { NeatPageNav } from './lib/page/page-nav';
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
export type { NeatBreadcrumb } from './lib/breadcrumbs/breadcrumbs';
export { NeatBreadcrumbs } from './lib/breadcrumbs/breadcrumbs';
export { NeatLiveDot } from './lib/live-dot/live-dot';
export { NeatSeriesSwatch } from './lib/series-swatch/series-swatch';
export { NeatNote } from './lib/note/note';
export { NeatStale, STALE_CLASSES as ɵSTALE_CLASSES } from './lib/stale/stale';
export { neatSecondsAgo } from './lib/time/seconds-ago';
export { neatEased } from './lib/motion/eased';
export { NeatEasedNumber } from './lib/motion/eased-number';
export { NEAT_EASINGS, type NeatEasing, type NeatEasingName } from './lib/motion/easing';
export { neatStoredSignal } from './lib/stored-signal';
export type { NeatTooltipPosition } from './lib/tooltip/tooltip';
export { NeatTooltip } from './lib/tooltip/tooltip';

/*
 * Not for apps. The `ɵ` exports are what the kit's secondary entry points share with this one:
 * ng-packagr gives each entry the built primary and nothing else, so the vendored helm code in
 * `lib/ui/` (never exported otherwise), the shell's toolbar token, the field label's classes
 * (which `select` and `field` share), the text field's and the collapsible section's looks
 * (which `input` and `collapsible` share with the page's side list), the stale look (which
 * `diagram` gives a node's card), the focus rules and surface
 * of a panel in the overlay (the popover's, shared with the shell's collapsed-rail menu, and the
 * helm classes its drift spec reads), the series' token rule (which `charts` and `diagram`
 * share with the swatch) and the browser's frame clock and reduced-motion check (which `charts`'
 * label timeline shares with `neatEased`), and the page's class colours with their identity palette and
 * style rows (which `video`'s overlays share with `bev`) reach them only through here. Angular marks its own
 * private API the same way; these may change or go in any release.
 */
export {
  BROWSER_CLOCK as ɵBROWSER_CLOCK,
  reducedMotion as ɵreducedMotion,
} from './lib/motion/eased';
export { COLLAPSIBLE_CLASSES as ɵCOLLAPSIBLE_CLASSES } from './lib/collapsible/collapsible-classes';
export { FIELD_LABEL_CLASSES as ɵFIELD_LABEL_CLASSES } from './lib/form/field-label';
export {
  INPUT_CLASSES as ɵINPUT_CLASSES,
  INPUT_HELM_CLASSES as ɵINPUT_HELM_CLASSES,
} from './lib/form/input-classes';
export { IN_PAGE_TOOLBAR as ɵIN_PAGE_TOOLBAR } from './lib/shell/page-toolbar';
export { OverlayFocus as ɵOverlayFocus } from './lib/overlay/overlay-focus';
export {
  classStyles as ɵclassStyles,
  styleFor as ɵstyleFor,
} from './lib/overlay-colors/class-styles';
export {
  createColorAllocator as ɵcreateColorAllocator,
  NeatOverlayColors as ɵNeatOverlayColors,
  resolveColor as ɵresolveColor,
} from './lib/overlay-colors/colors';
export type {
  ColorAllocator as ɵColorAllocator,
  ColorNamespace as ɵColorNamespace,
} from './lib/overlay-colors/colors';
export {
  OVERLAY_NEUTRAL_COLOR as ɵOVERLAY_NEUTRAL_COLOR,
  OVERLAY_PALETTE as ɵOVERLAY_PALETTE,
} from './lib/theme/identity-palette';
export {
  PANEL_SURFACE_CLASSES as ɵPANEL_SURFACE_CLASSES,
  POPOVER_HELM_CLASSES as ɵPOPOVER_HELM_CLASSES,
} from './lib/overlay/panel-surface';
export { listVariants as ɵlistVariants } from './lib/ui/tabs/src';
export {
  seriesToken as ɵseriesToken,
  seriesTokenName as ɵseriesTokenName,
} from './lib/series-swatch/series-swatch';
export { hlm as ɵhlm } from './lib/ui/utils/src';
