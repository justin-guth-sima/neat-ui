/*
 * Public API surface of @sima/neat-ui/card: a card on Spartan's, with an optional title and
 * subtitle, actions beside them and a footer. A secondary entry point, so an app's main bundle
 * carries it only if a page it loads imports it. It imports the primary entry point by package
 * name when it needs it; the primary never imports it. Every export added here is a promise to
 * consumers.
 */
export { NeatCard } from './lib/card';
