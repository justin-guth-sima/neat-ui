import * as diagram from './public-api';

describe('the diagram entry', () => {
  it('exports the diagram, its templates, its legend and the drill-down helper, nothing else', () => {
    expect(Object.keys(diagram).sort()).toEqual([
      'NeatDiagramBlockTemplate',
      'NeatDiagramEdgeTipTemplate',
      'NeatDiagramLegend',
      'NeatDiagramNoteTemplate',
      'NeatDiagramView',
      'neatDrillDownLevel',
    ]);
  });
});

// The model's types are exported. Nothing is checked at run time: this fails to compile, and with
// it `npm test` and `npm run build`, if one of them is dropped from the entry.
export type ExportedTypes = [
  diagram.NeatDiagram,
  diagram.NeatDiagramChip,
  diagram.NeatDiagramEdge,
  diagram.NeatDiagramLegendItem,
  diagram.NeatDiagramLine,
  diagram.NeatDiagramLook,
  diagram.NeatDiagramNode,
  diagram.NeatDiagramNote,
  diagram.NeatDiagramRole,
  diagram.NeatDiagramSet,
  diagram.NeatDiagramSide,
  diagram.NeatDiagramTip,
];
