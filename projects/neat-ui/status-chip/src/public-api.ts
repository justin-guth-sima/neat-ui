/*
 * Public API surface of @sima/neat-ui/status-chip: the badge's old names, deprecated in 0.44 and
 * kept for one release (`@sima/neat-ui/badge` is the badge). A secondary entry point, so an app's
 * main bundle carries it only if a page it loads imports it. It imports the primary entry point
 * (`@sima/neat-ui`) by package name; the primary never imports it. Every export added here is a
 * promise to consumers.
 */
export {
  NeatStatusChip,
  NeatStatusChipButton,
  type NeatStatusChipVariant,
} from './lib/status-chip';
