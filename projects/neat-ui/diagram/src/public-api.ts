/*
 * Public API surface of @sima/neat-ui/diagram: hand-placed diagrams in the kit's look, nodes in
 * frames with the edges routed between them, drawn by `neat-diagram`. A secondary entry point, so
 * an app's main bundle carries it only if a page it loads imports it. It imports the primary and
 * the status chip's entry only by their package names; the primary never imports it. The routing,
 * the port layout, the notes' placement and measurement, the fit and the pan and zoom stay
 * internal. Every export added here is a promise to consumers.
 */
export type {
  NeatDiagram,
  NeatDiagramChip,
  NeatDiagramEdge,
  NeatDiagramLine,
  NeatDiagramLook,
  NeatDiagramNode,
  NeatDiagramNote,
  NeatDiagramRole,
  NeatDiagramSet,
  NeatDiagramSide,
  NeatDiagramTip,
} from './lib/model';
export { NeatDiagramView } from './lib/diagram';
export { neatDrillDownLevel } from './lib/drill-down';
export { NeatDiagramBlockTemplate, NeatDiagramNoteTemplate } from './lib/templates';
