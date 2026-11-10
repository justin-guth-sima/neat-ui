import type { NeatDiagram, NeatDiagramNode } from '@sima/neat-ui/diagram';

/** The overview's blocks: the Detector's card is too small to hold its steps. */
const OVERVIEW_NODES: readonly NeatDiagramNode[] = [
  { id: 'camera', role: 'block', label: 'Camera', x: 0, y: 0, w: 170, h: 46, outSide: 'bottom' },
  {
    id: 'detector',
    role: 'block',
    label: 'Detector',
    detail: '3 steps',
    opens: 'detector',
    inSide: 'top',
    outSide: 'bottom',
    x: 0,
    y: 100,
    w: 170,
    h: 46,
  },
  { id: 'tracker', role: 'block', label: 'Tracker', inSide: 'top', x: 0, y: 200, w: 170, h: 46 },
];

/** A step of the Detector, in a row inside it below the level frame's title. */
const step = (id: string, label: string, i: number): NeatDiagramNode => ({
  id,
  role: 'block',
  label,
  parent: 'detector',
  x: 20 + i * 170,
  y: 72,
  w: 130,
  h: 40,
});

/**
 * The same pipeline with the Detector's steps inside it: the diagram a level is placed from. The
 * Camera and the Tracker are the Detector's neighbors, and the edges that end in a step are the
 * ones the level draws.
 */
export const WITH_STEPS: NeatDiagram = {
  nodes: [
    ...OVERVIEW_NODES,
    step('resize', 'Resize', 0),
    step('yolox', 'YOLOX', 1),
    step('nms', 'NMS', 2),
  ],
  edges: [
    { id: 'camera-resize', from: 'camera', to: 'resize', series: 1 },
    { id: 'resize-yolox', from: 'resize', to: 'yolox', line: 'dashed' },
    { id: 'yolox-nms', from: 'yolox', to: 'nms', line: 'dashed' },
    { id: 'nms-tracker', from: 'nms', to: 'tracker', series: 4 },
  ],
};

/** The overview: the Camera, the Detector, which opens a level, and the Tracker. */
export const OVERVIEW: NeatDiagram = {
  nodes: OVERVIEW_NODES,
  edges: [
    { id: 'camera-detector', from: 'camera', to: 'detector', series: 1 },
    { id: 'detector-tracker', from: 'detector', to: 'tracker', series: 4 },
  ],
};
