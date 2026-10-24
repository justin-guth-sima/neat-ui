/*
 * Public API surface of @sima/neat-ui/select: the select. A secondary entry point, so an app's
 * main bundle carries it only if a page it loads imports it. It imports the primary entry point
 * (`@sima/neat-ui`) by package name; the primary never imports it. Every export added here is a
 * promise to consumers.
 */
export type { NeatSelectOption, NeatSelectSize } from './lib/select';
export { NeatSelect } from './lib/select';
