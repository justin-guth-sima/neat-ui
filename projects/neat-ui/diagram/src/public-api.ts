/*
 * Public API surface of @sima/neat-ui/diagram: hand-placed diagrams in the kit's look, nodes in
 * frames with the edges routed between them, drawn by `neat-diagram`, the legend that names
 * their colours and lines (`neat-diagram-legend`), and the messages moving along the edges
 * (`neat-diagram-messages`), with the rate card for its numbers (`neat-diagram-rate-card`) and the
 * Animation panel for its tuning (`neat-diagram-animation-settings`). A secondary entry point, so
 * an app's main bundle carries it only if a page it loads imports it. It imports the primary, the
 * status chip's, the charts', the popover's, the slider's and the switch's entries only by their
 * package names; the primary never imports it. The routing, the port layout, the notes' placement
 * and measurement, the fit, the pan and zoom, the hover, the level path, and the messaging layer's
 * models, canvas and context (what a benchmark provides over another renderer) stay internal.
 * Every export added here is a promise to consumers.
 */
export type {
  NeatDiagram,
  NeatDiagramChip,
  NeatDiagramEdge,
  NeatDiagramHighlight,
  NeatDiagramPart,
  NeatDiagramPick,
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
export { NeatDiagramLegend, type NeatDiagramLegendItem } from './lib/legend';
export { neatDrillDownLevel } from './lib/drill-down';
export { neatBatchTimes, type NeatDiagramMessageStep } from './lib/messages/dot-model';
export {
  NEAT_DIAGRAM_MESSAGE_DEFAULTS,
  type NeatDiagramEdgeRate,
  type NeatDiagramMessageSettings,
  NeatDiagramMessages,
} from './lib/messages/messages';
export {
  NeatDiagramAnimationSettings,
  neatParseMessageSettings,
} from './lib/messages/animation-settings';
export { NeatDiagramRateCard } from './lib/messages/rate-card';
export {
  NeatDiagramBlockTemplate,
  NeatDiagramEdgeTipTemplate,
  NeatDiagramNoteTemplate,
} from './lib/templates';
