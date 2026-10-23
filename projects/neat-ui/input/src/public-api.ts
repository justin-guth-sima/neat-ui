/*
 * Public API surface of @sima/neat-ui/input: the text input. A secondary entry point, so an app's
 * main bundle carries it only if a page it loads imports it. It imports the primary entry point
 * (`@sima/neat-ui`) by package name; the primary never imports it. Every export added here is a
 * promise to consumers.
 */
export type { NeatInputSize } from './lib/input';
export { NeatInput } from './lib/input';
