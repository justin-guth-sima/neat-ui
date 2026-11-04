/*
 * Public API surface of @sima/neat-ui/panel: a titled panel in the kit's card look, with actions
 * beside its heading. A secondary entry point, so an app's main bundle carries it only if a page
 * it loads imports it. It imports the primary entry point by package name when it needs it; the
 * primary never imports it. Every export added here is a promise to consumers.
 */
export { NeatPanel, NeatPanelActions } from './lib/panel';
