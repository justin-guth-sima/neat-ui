import {
  type NeatDiagram,
  type NeatDiagramChip,
  type NeatDiagramEdge,
  type NeatDiagramLegendItem,
  type NeatDiagramNode,
  type NeatDiagramSet,
  neatDrillDownLevel,
} from '@sima/neat-ui/diagram';
import { A65, EV74, HW, MLA } from './chips';

/*
 * The reference sheet's messaging pipeline (insight-next, docs/superpowers/reference/diagram):
 * laptop, cable, board, placed after the sheet with room for the kit's type and edge labels. The
 * diagram fits each level to its box, so where a level starts does not matter.
 */

const PIPELINE_NODES: readonly NeatDiagramNode[] = [
  { id: 'laptop', role: 'group', label: 'Laptop', x: 0, y: 0, w: 170, h: 360 },
  {
    id: 'camera',
    role: 'block',
    label: 'Camera',
    detail: 'USB',
    parent: 'laptop',
    x: 20,
    y: 56,
    w: 130,
    h: 46,
  },
  {
    id: 'gateway',
    role: 'block',
    label: 'Gateway',
    inSide: 'right',
    outSide: 'bottom',
    parent: 'laptop',
    x: 20,
    y: 190,
    w: 130,
    h: 46,
  },
  {
    id: 'browser',
    role: 'block',
    label: 'Browser',
    inSide: 'top',
    parent: 'laptop',
    x: 20,
    y: 290,
    w: 130,
    h: 46,
  },
  { id: 'ethernet', role: 'band', label: 'Ethernet', x: 186, y: 0, w: 30, h: 360 },
  { id: 'modalix', role: 'group', look: 'accent', label: 'Modalix', x: 232, y: 0, w: 300, h: 360 },
  {
    id: 'decode',
    role: 'block',
    label: 'Decode',
    chips: [HW],
    outSide: 'bottom',
    parent: 'modalix',
    // Sized for its body below the label too: the example's figure line (neatDiagramBlock).
    x: 20,
    y: 50,
    w: 170,
    h: 58,
  },
  {
    id: 'detector',
    role: 'block',
    label: 'Detector',
    chips: [MLA],
    opens: 'detector',
    inSide: 'top',
    outSide: 'bottom',
    parent: 'modalix',
    // Far enough below Decode for the label of the edge between them, with its arrow.
    x: 20,
    y: 156,
    w: 170,
    h: 46,
  },
  {
    id: 'tracker',
    role: 'block',
    label: 'Tracker',
    chips: [A65],
    inSide: 'top',
    outSide: 'left',
    parent: 'modalix',
    x: 35,
    y: 246,
    w: 140,
    h: 40,
  },
];

const PIPELINE_EDGES: readonly NeatDiagramEdge[] = [
  { id: 'camera-decode', from: 'camera', to: 'decode', series: 1 },
  { id: 'tracker-gateway', from: 'tracker', to: 'gateway', series: 4 },
  { id: 'gateway-browser', from: 'gateway', to: 'browser', series: 4 },
];

/** A step of the Detector, in a row inside it below the level group's title. */
const step = (id: string, label: string, chip: NeatDiagramChip, i: number): NeatDiagramNode => ({
  id,
  role: 'block',
  label,
  chips: [chip],
  parent: 'detector',
  x: 20 + i * 170,
  y: 72,
  w: 130,
  h: 40,
});

/**
 * The pipeline with the Detector's steps inside it, which the overview leaves out (its card is
 * too small to hold them): what `neatDrillDownLevel` places the Detector's level from.
 */
const PIPELINE_STEPS: NeatDiagram = {
  nodes: [
    ...PIPELINE_NODES,
    step('resize', 'Resize', EV74, 0),
    step('yolox', 'YOLOX', MLA, 1),
    step('nms', 'NMS', A65, 2),
  ],
  edges: [
    ...PIPELINE_EDGES,
    { id: 'decode-resize', from: 'decode', to: 'resize', series: 1 },
    // The steps hand frames on inside the process: dashed and muted, as the demo draws them.
    { id: 'resize-yolox', from: 'resize', to: 'yolox', line: 'dashed' },
    { id: 'yolox-nms', from: 'yolox', to: 'nms', line: 'dashed' },
    { id: 'nms-tracker', from: 'nms', to: 'tracker', series: 4 },
  ],
};

export const PIPELINE: NeatDiagramSet = {
  overview: {
    nodes: PIPELINE_NODES,
    edges: [
      ...PIPELINE_EDGES,
      // Labeled, so the dots are seen passing behind an edge label.
      { id: 'decode-detector', from: 'decode', to: 'detector', series: 1, label: 'frames' },
      { id: 'detector-tracker', from: 'detector', to: 'tracker', series: 4 },
    ],
    notes: [
      // Above the groups (they start at y 0; the card is about 85 high), clear of the Camera.
      { id: 'camera-rate', edges: ['camera-decode'], x: 215, y: -50 },
      // A note's x and y are its center: below the Modalix group (which ends at y 360), so the card
      // straddles no border, and its leader runs clear of it.
      { id: 'tracker-rate', edges: ['detector-tracker'], x: 330, y: 410 },
    ],
  },
  levels: {
    detector: {
      ...neatDrillDownLevel(PIPELINE_STEPS, 'detector'),
      // The card of a step: its stage time in place of the megabytes. Below the level's group
      // (which ends at y 152), under the edge it is about.
      notes: [{ id: 'yolox-rate', edges: ['yolox-nms'], x: 340, y: 235 }],
    },
  },
};

export const PIPELINE_LEGEND: readonly NeatDiagramLegendItem[] = [
  { series: 1, label: 'image' },
  { series: 4, label: 'results' },
  { line: 'dashed', label: 'inside the Detector' },
];
