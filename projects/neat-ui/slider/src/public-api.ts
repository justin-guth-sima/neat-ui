/*
 * Public API surface of @sima/neat-ui/slider: the slider. A secondary entry point, so an app's main
 * bundle carries it only if a page it loads imports it. It imports the primary entry point
 * (`@sima/neat-ui`) by package name; the primary never imports it. Every export added here is a
 * promise to consumers.
 */
export { NeatSlider } from './lib/slider';
