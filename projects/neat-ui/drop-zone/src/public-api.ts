/*
 * Public API surface of @sima/neat-ui/drop-zone: the file drop zone. A secondary entry point, so
 * an app's main bundle carries it only if a page it loads imports it. It imports the primary entry
 * point (`@sima/neat-ui`) by package name; the primary never imports it. Every export added here
 * is a promise to consumers.
 */
export { NeatDropZone } from './lib/drop-zone';
