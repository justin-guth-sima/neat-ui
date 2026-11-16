/*
 * Public API surface of @sima/neat-ui/search-palette: a search over the whole app, opened from a
 * trigger in the top bar or by Ctrl K. A secondary entry point, so an app's main bundle carries it
 * only if a page it loads imports it. It imports the primary entry point (`@sima/neat-ui`) by
 * package name; the primary never imports it. Every export added here is a promise to consumers.
 */
export type {
  NeatSearchGroup,
  NeatSearchItem,
  NeatSearchPaletteLabels,
} from './lib/search-palette';
export { NeatSearchPalette } from './lib/search-palette';
