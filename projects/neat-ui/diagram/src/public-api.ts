/*
 * Public API surface of @sima/neat-ui/diagram: hand-placed diagrams in the kit's look, nodes in
 * frames with the edges routed between them. A secondary entry point, so an app's main bundle
 * carries it only if a page it loads imports it. It imports the primary only by its package name;
 * the primary never imports it. The routing and the port layout stay internal. Every export added
 * here is a promise to consumers.
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
