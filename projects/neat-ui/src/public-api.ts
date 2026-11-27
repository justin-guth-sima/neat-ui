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
export { NeatPageToolbar, NeatPageToolbarDivider } from './lib/shell/page-toolbar';
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
export { NeatLiveBadge } from './lib/live-badge/live-badge';
export { NeatLiveDot } from './lib/live-dot/live-dot';
export { NeatSeriesSwatch } from './lib/series-swatch/series-swatch';
export { NeatSwatch } from './lib/swatch/swatch';
export { NeatNote } from './lib/note/note';
export { NeatProse } from './lib/prose/prose';
export {
  NEAT_TYPOGRAPHY,
  NeatBlockquote,
  NeatH1,
  NeatH2,
  NeatH3,
  NeatH4,
  NeatLarge,
  NeatLead,
  NeatMuted,
  NeatP,
  NeatSmall,
  NeatUl,
} from './lib/typography/typography';
export { NeatExpand } from './lib/expand/expand';
export type { NeatFieldWidth } from './lib/form/field-width';
export type { NeatSearchSize, NeatSearchVariant } from './lib/search/search';
export { NeatSearch } from './lib/search/search';
export { NeatShortcut } from './lib/shortcut/shortcut';
export { NeatStale, STALE_CLASSES as ɵSTALE_CLASSES } from './lib/stale/stale';
export { neatDuration, type NeatDurationOptions } from './lib/time/duration';
export { neatSecondsAgo } from './lib/time/seconds-ago';
export { neatEased } from './lib/motion/eased';
export { NeatEasedNumber } from './lib/motion/eased-number';
export { NEAT_EASINGS, type NeatEasing, type NeatEasingName } from './lib/motion/easing';
export { neatStoredSignal } from './lib/stored-signal';
export type { NeatTooltipPosition } from './lib/tooltip/tooltip';
export { NeatTooltip } from './lib/tooltip/tooltip';

/*
 * Not for apps. The `ɵ` exports are what the kit's secondary entry points share with this one:
 * ng-packagr gives each entry the built primary and nothing else, so they reach these only through
 * here. Angular marks its own private API the same way; these may change or go in any release.
 *
 * - `ɵhlm`, `ɵlistVariants`: the vendored helm code in `lib/ui/` (never exported otherwise), its
 *   class merge and the tab list's variants.
 * - `ɵIN_PAGE_TOOLBAR`: the shell's toolbar token, which the popover reads.
 * - `ɵFIELD_LABEL_CLASSES`: a field's name over its control, which `select` and `field` share.
 * - `ɵFIELD_CLASSES`: the rest of the field's helm strings, which `field` and its error note take.
 * - `ɵFIELD_WIDTH_CLASSES`: the field parts' widths, which `input`, `select` and `number-field`
 *   share with the search field.
 * - `ɵINPUT_CLASSES`, `ɵINPUT_HELM_CLASSES`: the text field's look, which `input` and
 *   `number-field` share with the search field.
 * - `ɵCOLLAPSIBLE_CLASSES`: the collapsible section's look, which `collapsible` shares with the
 *   page nav.
 * - `ɵSEPARATOR_HELM_CLASSES`: helm's separator, which the popover's divider shares with the rail's
 *   and the toolbar's.
 * - `ɵSTALE_CLASSES`: the stale look, which `diagram` gives a node's card.
 * - `ɵTONE_DOT_COLORS`: the tone dots' colors, which `collapsible` shares with the rail item.
 * - `ɵOverlayFocus`, `ɵPANEL_SURFACE_CLASSES`, `ɵPOPOVER_HELM_CLASSES`: the focus rules and the
 *   surface of a panel in the overlay, the popover's, shared with the shell's collapsed-rail menu
 *   (the surface with `bubble` and `search-palette` too), and the helm classes its drift spec
 *   reads.
 * - `ɵseriesToken`, `ɵseriesTokenName`: the series' token rule, which `charts` and `diagram` share
 *   with the swatch.
 * - `ɵBROWSER_CLOCK`, `ɵFrameClock`, `ɵreducedMotion`: the browser's frame clock, its type and
 *   the reduced-motion check, which `charts`' label timeline, `code-block` and the `markdown` and
 *   `chat` motions share with `neatEased`.
 * - `ɵFrameLoop`, `ɵFrameLoopHost`: the motions' frame loop, which `markdown` and `chat` share.
 * - `ɵNeatOverlayColors`, `ɵcreateColorAllocator`, `ɵColorAllocator`, `ɵColorNamespace`,
 *   `ɵresolveColor`, `ɵheldColor`, `ɵOVERLAY_PALETTE`, `ɵOVERLAY_NEUTRAL_COLOR`, `ɵclassStyles`,
 *   `ɵstyleFor`: the page's class colors with their identity palette and style rows, which
 *   `video`'s overlays share with `bev`.
 * - `ɵREADOUT_CLASSES`: the readout's look, which `charts` and `bev` share.
 * - `ɵbadgeClasses`, `ɵbadgeButtonClasses`: the badge's look, which `badge` and the status chip's
 *   deprecated aliases share with the live badge.
 */
export {
  BROWSER_CLOCK as ɵBROWSER_CLOCK,
  reducedMotion as ɵreducedMotion,
} from './lib/motion/eased';
export type { FrameClock as ɵFrameClock } from './lib/motion/eased';
export {
  FrameLoop as ɵFrameLoop,
  type FrameLoopHost as ɵFrameLoopHost,
} from './lib/motion/frame-loop';
export {
  badgeButtonClasses as ɵbadgeButtonClasses,
  badgeClasses as ɵbadgeClasses,
} from './lib/badge/badge-classes';
export { COLLAPSIBLE_CLASSES as ɵCOLLAPSIBLE_CLASSES } from './lib/collapsible/collapsible-classes';
export {
  FIELD_CLASSES as ɵFIELD_CLASSES,
  FIELD_LABEL_CLASSES as ɵFIELD_LABEL_CLASSES,
} from './lib/form/field-label';
export { FIELD_WIDTH_CLASSES as ɵFIELD_WIDTH_CLASSES } from './lib/form/field-width';
export {
  INPUT_CLASSES as ɵINPUT_CLASSES,
  INPUT_HELM_CLASSES as ɵINPUT_HELM_CLASSES,
} from './lib/form/input-classes';
export { IN_PAGE_TOOLBAR as ɵIN_PAGE_TOOLBAR } from './lib/shell/page-toolbar';
export { hlmSeparatorClass as ɵSEPARATOR_HELM_CLASSES } from './lib/ui/separator/src';
export { READOUT_CLASSES as ɵREADOUT_CLASSES } from './lib/readout/readout-classes';
export { OverlayFocus as ɵOverlayFocus } from './lib/overlay/overlay-focus';
export {
  classStyles as ɵclassStyles,
  styleFor as ɵstyleFor,
} from './lib/overlay-colors/class-styles';
export {
  createColorAllocator as ɵcreateColorAllocator,
  heldColor as ɵheldColor,
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
export { TONE_DOT_COLORS as ɵTONE_DOT_COLORS } from './lib/theme/tone';
export { hlm as ɵhlm } from './lib/ui/utils/src';
