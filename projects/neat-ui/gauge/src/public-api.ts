/*
 * Public API surface of @sima/neat-ui/gauge: a live value within a range, drawn as a ¾ arc. A
 * secondary entry point, so an app's main bundle carries it only if a page it loads imports it.
 * It imports the primary entry point by package name; the primary never imports it. Every export
 * added here is a promise to consumers.
 */
export { NeatGauge, type NeatGaugeZones } from './lib/gauge';
