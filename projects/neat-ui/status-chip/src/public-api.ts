/*
 * Public API surface of @sima/neat-ui/status-chip: a short label on a status fill. A secondary entry
 * point, so an app's main bundle carries it only if a page it loads imports it. It imports the
 * primary entry point (`@sima/neat-ui`) by package name; the primary never imports it. Every export
 * added here is a promise to consumers.
 */
export type { NeatStatusTone } from './lib/status-chip';
export { NeatStatusChip, NeatStatusChipButton } from './lib/status-chip';
