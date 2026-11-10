/*
 * Public API surface of @sima/neat-ui/charts: live charts drawn as SVG over the kit's series and
 * line tokens. A secondary entry point, so an app's main bundle carries it (and the two d3
 * packages it draws with) only if a page it loads imports it. It imports the primary only by its
 * package name; the primary never imports it. Every export added here is a promise to consumers.
 */
export { NeatChartCard } from './lib/chart-card';
export { NeatHeatmap, type NeatHeatmapRow } from './lib/heatmap';
// The swatch moved to the primary (the diagram's legend shows it too); still exported here so
// the apps that import it from this entry keep working.
export { NeatSeriesSwatch } from '@sima/neat-ui';
export { neatLabelColour } from './lib/label-colour';
export {
  type NeatLabelRun,
  NeatLabelTimeline,
  type NeatTimelineMotion,
} from './lib/label-timeline';
export { type NeatScore, NeatScoreBars } from './lib/score-bars';
export { NeatSparkline } from './lib/sparkline';
export { NeatStackedChart } from './lib/stacked-chart';
export { NeatTimeChart } from './lib/time-chart';
export type {
  NeatChartAxis,
  NeatChartFormat,
  NeatChartTone,
  NeatHeatmapCell,
  NeatHeatmapPick,
  NeatReference,
  NeatRunPick,
  NeatSamplePick,
  NeatSeries,
  NeatThreshold,
} from './lib/types';
