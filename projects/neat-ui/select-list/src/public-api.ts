/*
 * Public API surface of @sima/neat-ui/select-list: the selectable, column-templated list. A
 * secondary entry point, so an app's main bundle carries it only if a page it loads imports it. It
 * imports the primary entry point (`@sima/neat-ui`) by package name; the primary never imports it.
 * Every export added here is a promise to consumers.
 */
export { NeatColumn } from './lib/select-list';
export { NeatSelectList } from './lib/select-list';
export type { NeatSelectListGroup } from './lib/select-list';
