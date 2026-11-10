import * as diagram from './public-api';

describe('the diagram entry', () => {
  it('exports the diagram, its templates, legend, messages, rate card and animation panel', () => {
    expect(Object.keys(diagram).sort()).toEqual([
      'NEAT_DIAGRAM_MESSAGE_DEFAULTS',
      'NeatDiagramAnimationSettings',
      'NeatDiagramBlockTemplate',
      // The old name, deprecated, kept for apps that import it.
      'NeatDiagramEdgeTipTemplate',
      'NeatDiagramEdgeTooltipTemplate',
      'NeatDiagramLegend',
      'NeatDiagramMessages',
      'NeatDiagramNoteTemplate',
      'NeatDiagramRateCard',
      'NeatDiagramView',
      'neatBatchTimes',
      'neatDrillDownLevel',
      'neatParseMessageSettings',
    ]);
  });
});

// The model's types are exported. Nothing is checked at run time: this fails to compile, and with
// it `npm test` and `npm run build`, if one of them is dropped from the entry.
export type ExportedTypes = [
  diagram.NeatDiagram,
  diagram.NeatDiagramChip,
  diagram.NeatDiagramEdge,
  diagram.NeatDiagramEdgeRate,
  diagram.NeatDiagramLegendItem,
  diagram.NeatDiagramLine,
  diagram.NeatDiagramLook,
  diagram.NeatDiagramMessageSettings,
  diagram.NeatDiagramMessageStep,
  diagram.NeatDiagramNode,
  diagram.NeatDiagramNote,
  diagram.NeatDiagramRole,
  diagram.NeatDiagramSet,
  diagram.NeatDiagramSide,
  diagram.NeatDiagramTip,
];
