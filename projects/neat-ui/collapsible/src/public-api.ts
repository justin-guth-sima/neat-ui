/*
 * Public API surface of @sima/neat-ui/collapsible: a section that a labeled button opens and
 * closes. A secondary entry point, so an app's main bundle carries it only if a page it loads
 * imports it. It imports the primary entry point (`@sima/neat-ui`) by package name; the primary
 * never imports it. Every export added here is a promise to consumers.
 */
export { NeatCollapsible, type NeatCollapsibleVariant } from './lib/collapsible';
