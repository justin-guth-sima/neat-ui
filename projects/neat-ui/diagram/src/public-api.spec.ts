import * as diagram from './public-api';

describe('the diagram entry', () => {
  it('exports the drill-down helper; the routing, the layout, notes and fit stay internal', () => {
    expect(Object.keys(diagram)).toEqual(['neatDrillDownLevel']);
  });
});

// The model's types are exported. Nothing is checked at run time: this fails to compile, and with
// it `npm test` and `npm run build`, if one of them is dropped from the entry.
export type ExportedTypes = [
  diagram.NeatDiagram,
  diagram.NeatDiagramChip,
  diagram.NeatDiagramEdge,
  diagram.NeatDiagramLine,
  diagram.NeatDiagramLook,
  diagram.NeatDiagramNode,
  diagram.NeatDiagramNote,
  diagram.NeatDiagramRole,
  diagram.NeatDiagramSet,
  diagram.NeatDiagramSide,
  diagram.NeatDiagramTip,
];
