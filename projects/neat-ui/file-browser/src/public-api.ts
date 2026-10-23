/*
 * Public API surface of @sima/neat-ui/file-browser: the file browser over a tree of folders and
 * files. A secondary entry point, so an app's main bundle carries it only if a page it loads
 * imports it. It imports the primary entry point (`@sima/neat-ui`) and the other entries it is
 * built from (`@sima/neat-ui/select-list`, `@sima/neat-ui/input`) by package name; the primary
 * never imports it. Every export added here is a promise to consumers.
 */
export type { NeatFileBrowserLabels, NeatFileBrowserMode } from './lib/file-browser';
export { NeatFileBrowser } from './lib/file-browser';
export type { NeatFileNode } from './lib/file-tree';
