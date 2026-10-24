import * as primary from '@sima/neat-ui';
import * as charts from './public-api';

describe('the charts entry', () => {
  it('exports its components and nothing from the primary', () => {
    // The geometry stays internal: only the components are runtime exports (the types are erased).
    expect(Object.keys(charts).sort()).toEqual([
      'NeatChartCard',
      'NeatHeatmap',
      'NeatSparkline',
      'NeatStackedChart',
      'NeatTimeChart',
    ]);
    expect(Object.keys(charts).filter((symbol) => symbol in primary)).toEqual([]);
  });
});

// The types are exported too. Nothing is checked at run time: this fails to compile, and with it
// `npm test` and `npm run build`, if one of them is dropped from the entry.
export type ExportedTypes = [
  charts.NeatChartFormat,
  charts.NeatChartTone,
  charts.NeatHeatmapRow,
  charts.NeatReference,
  charts.NeatSeries,
  charts.NeatThreshold,
];
