/*
 * Public API surface of @sima/neat-ui/field: a form control under its visible name, and the error
 * note said in place. A secondary entry point, so an app's main bundle carries it only if a page it
 * loads imports it. It imports the primary entry point (`@sima/neat-ui`) and `@sima/neat-ui/input`
 * by package name; the primary never imports it. Every export added here is a promise to consumers.
 */
export { NeatErrorNote } from './lib/error-note';
export { NeatField } from './lib/field';
