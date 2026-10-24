/*
 * Public API surface of @sima/neat-ui/dialog: the general modal dialog. A secondary entry point, so
 * an app's main bundle carries it only if a page it loads imports it. It imports the primary entry
 * point (`@sima/neat-ui`) by package name; the primary never imports it. Every export added here
 * is a promise to consumers.
 */
export type { NeatDialogComponentOptions, NeatDialogInputs, NeatDialogOptions } from './lib/dialog';
export { NeatDialog } from './lib/dialog';
export type { NeatDialogSize } from './lib/dialog-panel';
export { NeatDialogActions, NeatDialogBody } from './lib/dialog-parts';
export { NeatDialogRef } from './lib/dialog-ref';
