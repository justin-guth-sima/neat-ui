/*
 * Public API surface of @sima/neat-ui/segmented: the segmented control. A secondary entry point, so
 * an app's main bundle carries it only if a page it loads imports it. It imports the primary entry
 * point (`@sima/neat-ui`) by package name; the primary never imports it. Every export added here is
 * a promise to consumers.
 */
export type { NeatSegmentedOption } from './lib/segmented';
export { NeatSegmented } from './lib/segmented';
