/*
 * Public API surface of @sima/neat-ui/level-meter: a live audio level as a bar of segments. A
 * secondary entry point, so an app's main bundle carries it only if a page it loads imports it.
 * It imports nothing from the primary entry point; the primary never imports it. Every export
 * added here is a promise to consumers.
 */
export { NeatLevelMeter } from './lib/level-meter';
