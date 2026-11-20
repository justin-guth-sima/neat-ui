/*
 * Public API surface of @sima/neat-ui/bubble: a speech bubble with a tail, anchored to an element
 * it explains. A secondary entry point, so an app's main bundle carries it only if a page it loads
 * imports it. It imports the primary entry point (`@sima/neat-ui`) by package name; the primary
 * never imports it. Every export added here is a promise to consumers.
 */
export { NeatBubble, type NeatBubbleSide } from './lib/bubble';
export type { NeatBubbleAnchor } from './lib/anchor';
