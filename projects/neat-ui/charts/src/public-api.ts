/*
 * Public API surface of @sima/neat-ui/charts: live charts drawn as SVG over the kit's series and
 * line tokens. A secondary entry point, so an app's main bundle carries it (and the two d3
 * packages it draws with) only if a page it loads imports it. It imports the primary only by its
 * package name; the primary never imports it. Every export added here is a promise to consumers.
 */
export { NeatSparkline } from './lib/sparkline';
export { NeatTimeChart } from './lib/time-chart';
export type {
  NeatChartFormat,
  NeatChartTone,
  NeatReference,
  NeatSeries,
  NeatThreshold,
} from './lib/types';
