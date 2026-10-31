import {
  type NeatDiagram,
  type NeatDiagramChip,
  type NeatDiagramEdge,
  type NeatDiagramLegendItem,
  type NeatDiagramMessageStep,
  type NeatDiagramNode,
  type NeatDiagramSet,
  neatDrillDownLevel,
} from '@sima/neat-ui/diagram';

/*
 * The reference sheet's three examples (insight-next, docs/superpowers/reference/diagram): a
 * messaging pipeline, a compile flow and a model graph, placed after the sheet with room for the
 * kit's type and edge labels. The diagram fits each level to its box, so where a level starts
 * does not matter. The chips follow the kit's convention for where a part runs: HW (the hardware
 * decoder) success, EV74 highlight, MLA info, A65 neutral.
 */

const HW = { label: 'HW', tone: 'success' } as const;
const EV74 = { label: 'EV74', tone: 'highlight' } as const;
const MLA = { label: 'MLA', tone: 'info' } as const;
const A65 = { label: 'A65', tone: 'neutral' } as const;

// --- (a) a messaging pipeline: laptop, cable, board, with its messages moving

const PIPELINE_NODES: readonly NeatDiagramNode[] = [
  { id: 'laptop', role: 'frame', label: 'Laptop', x: 0, y: 0, w: 170, h: 360 },
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
  { id: 'modalix', role: 'frame', look: 'accent', label: 'Modalix', x: 232, y: 0, w: 300, h: 360 },
  {
    id: 'decode',
    role: 'block',
    label: 'Decode',
    chips: [HW],
    outSide: 'bottom',
    parent: 'modalix',
    // Sized for its body below the label too: the page's figure line (neatDiagramBlock).
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
    x: 20,
    y: 140,
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
    y: 230,
    w: 140,
    h: 40,
  },
];

const PIPELINE_EDGES: readonly NeatDiagramEdge[] = [
  { id: 'camera-decode', from: 'camera', to: 'decode', series: 1 },
  { id: 'tracker-gateway', from: 'tracker', to: 'gateway', series: 4 },
  { id: 'gateway-browser', from: 'gateway', to: 'browser', series: 4 },
];

/** A step of the Detector, in a row inside it below the level frame's title. */
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
      { id: 'decode-detector', from: 'decode', to: 'detector', series: 1 },
      { id: 'detector-tracker', from: 'detector', to: 'tracker', series: 4 },
    ],
    notes: [
      // Above the frames, clear of the Camera's edge.
      { id: 'camera-rate', edges: ['camera-decode'], x: 215, y: -50 },
      // Below the Tracker, so its leader runs clear of the card.
      { id: 'tracker-rate', edges: ['tracker-gateway'], x: 330, y: 320 },
    ],
  },
  levels: { detector: neatDrillDownLevel(PIPELINE_STEPS, 'detector') },
};

/**
 * The Detector's steps for the messaging layer: a frame that reaches Resize goes on to YOLOX once
 * Resize's stage time has passed, and on to NMS after YOLOX's.
 */
export const PIPELINE_MESSAGE_STEPS: Readonly<Record<string, NeatDiagramMessageStep>> = {
  'resize-yolox': { from: 'detector', stage: 'resize' },
  'yolox-nms': { from: 'detector', stage: 'yolox' },
};

export const PIPELINE_LEGEND: readonly NeatDiagramLegendItem[] = [
  { series: 1, label: 'image' },
  { series: 4, label: 'results' },
  { line: 'dashed', label: 'inside the Detector' },
];

// --- (b) a compile flow: a column of steps, with an input beside it and an optional step

export const COMPILE_FLOW: NeatDiagramSet = {
  overview: {
    nodes: [
      { id: 'onnx', role: 'block', label: 'model.onnx', detail: 'FP32', x: 0, y: 0, w: 150, h: 46 },
      {
        id: 'surgery',
        role: 'block',
        label: 'Model surgery',
        detail: 'unsupported ops',
        x: 0,
        y: 80,
        w: 150,
        h: 46,
      },
      {
        id: 'quantize',
        role: 'block',
        label: 'Quantize',
        detail: 'INT8',
        x: 0,
        y: 160,
        w: 150,
        h: 46,
      },
      { id: 'compile', role: 'block', label: 'Compile', chips: [MLA], x: 0, y: 240, w: 150, h: 46 },
      {
        id: 'archive',
        role: 'block',
        label: 'model.tar.gz',
        detail: 'archive',
        x: 0,
        y: 320,
        w: 150,
        h: 46,
      },
      {
        id: 'calibration',
        role: 'block',
        look: 'muted',
        label: 'Calibration set',
        detail: '200 images',
        x: 220,
        y: 80,
        w: 160,
        h: 46,
      },
      {
        id: 'accuracy',
        role: 'block',
        look: 'ghost',
        label: 'Accuracy check',
        detail: 'optional',
        // Level with the lower of Quantize's two right-hand ports (they sit 10 apart about its
        // middle, 183), so the ghost edge runs straight.
        x: 220,
        y: 165,
        w: 160,
        h: 46,
      },
    ],
    edges: [
      { id: 'onnx-surgery', from: 'onnx', to: 'surgery', series: 1 },
      { id: 'surgery-quantize', from: 'surgery', to: 'quantize', series: 1 },
      { id: 'calibration-quantize', from: 'calibration', to: 'quantize', series: 2 },
      { id: 'quantize-compile', from: 'quantize', to: 'compile', series: 1 },
      { id: 'quantize-accuracy', from: 'quantize', to: 'accuracy', line: 'ghost' },
      { id: 'compile-archive', from: 'compile', to: 'archive', series: 3 },
    ],
    // About the Compile step, so anchored to its right side rather than to an edge.
    notes: [{ id: 'compile-result', anchor: { x: 150, y: 263 }, x: 305, y: 270 }],
  },
};

export const COMPILE_LEGEND: readonly NeatDiagramLegendItem[] = [
  { series: 1, label: 'model' },
  { series: 2, label: 'calibration data' },
  { series: 3, label: 'archive' },
  { line: 'ghost', label: 'not run here' },
];

// --- (c) a model graph: tensor shapes on the edges, a backbone, and levels two deep

const dark = (label: string, i: number, more: Partial<NeatDiagramNode> = {}): NeatDiagramNode => ({
  id: label.toLowerCase(),
  role: 'block',
  label,
  chips: [MLA],
  parent: 'stages',
  x: 20 + i * 260,
  y: 72,
  w: 140,
  h: 40,
  ...more,
});

const layer = (id: string, label: string, detail: string, i: number): NeatDiagramNode => ({
  id,
  role: 'block',
  label,
  detail,
  chips: [MLA],
  parent: 'dark5',
  x: 20 + i * 280,
  y: 72,
  w: 150,
  h: 46,
});

export const MODEL_GRAPH: NeatDiagramSet = {
  overview: {
    nodes: [
      // Straight above the Stem, so its edge runs down clear of the Backbone's title.
      {
        id: 'input',
        role: 'block',
        label: 'Input',
        outSide: 'bottom',
        x: 110,
        y: 0,
        w: 120,
        h: 40,
      },
      {
        id: 'backbone',
        role: 'frame',
        look: 'dashed',
        label: 'Backbone',
        detail: 'CSPDarknet',
        x: 0,
        y: 70,
        w: 410,
        h: 150,
      },
      {
        id: 'stem',
        role: 'block',
        label: 'Stem',
        chips: [MLA],
        inSide: 'top',
        parent: 'backbone',
        x: 110,
        y: 75,
        w: 120,
        h: 40,
      },
      {
        id: 'stages',
        role: 'block',
        label: 'Stages',
        chips: [MLA],
        opens: 'stages',
        outSide: 'bottom',
        parent: 'backbone',
        x: 250,
        y: 75,
        w: 140,
        h: 40,
      },
      {
        id: 'head',
        role: 'block',
        label: 'Head',
        chips: [MLA],
        inSide: 'top',
        x: 0,
        y: 250,
        w: 140,
        h: 40,
      },
      {
        id: 'nms',
        role: 'block',
        label: 'Decode + NMS',
        chips: [EV74],
        outSide: 'bottom',
        x: 270,
        y: 250,
        w: 190,
        h: 40,
      },
      { id: 'boxes', role: 'block', label: 'Boxes', inSide: 'top', x: 305, y: 330, w: 120, h: 40 },
    ],
    edges: [
      {
        id: 'input-stem',
        from: 'input',
        to: 'stem',
        series: 1,
        label: '1×3×640×640',
        labelAt: 0.3,
      },
      { id: 'stem-stages', from: 'stem', to: 'stages', series: 1 },
      { id: 'stages-head', from: 'stages', to: 'head', series: 1 },
      { id: 'head-nms', from: 'head', to: 'nms', series: 4, label: '3 × 1×85×80²' },
      { id: 'nms-boxes', from: 'nms', to: 'boxes', series: 3 },
    ],
  },
  levels: {
    stages: {
      nodes: [
        {
          id: 'stages',
          role: 'frame',
          look: 'dashed',
          label: 'Stages',
          detail: 'CSPDarknet, four stages',
          x: 0,
          y: 0,
          w: 960,
          h: 176,
        },
        dark('Dark2', 0),
        dark('Dark3', 1),
        dark('Dark4', 2),
        dark('Dark5', 3, { opens: 'dark5' }),
        {
          id: 'outputs',
          role: 'bracket',
          label: 'To the head',
          detail: 'strides 8, 16, 32',
          parent: 'stages',
          x: 280,
          y: 120,
          w: 660,
          h: 40,
        },
      ],
      edges: [
        { id: 'dark2-dark3', from: 'dark2', to: 'dark3', series: 1, label: '1×128×160²' },
        { id: 'dark3-dark4', from: 'dark3', to: 'dark4', series: 1, label: '1×256×80²' },
        { id: 'dark4-dark5', from: 'dark4', to: 'dark5', series: 1, label: '1×512×40²' },
      ],
    },
    dark5: {
      nodes: [
        {
          id: 'dark5',
          role: 'frame',
          look: 'dashed',
          label: 'Dark5',
          detail: 'stride 32',
          x: 0,
          y: 0,
          w: 750,
          h: 140,
        },
        layer('dark5-conv', 'Conv 3×3', 'stride 2', 0),
        layer('dark5-spp', 'SPP', 'pools 5, 9, 13', 1),
        layer('dark5-csp', 'CSP layer', '1 bottleneck', 2),
      ],
      edges: [
        { id: 'conv-spp', from: 'dark5-conv', to: 'dark5-spp', series: 1, label: '1×1024×20²' },
        { id: 'spp-csp', from: 'dark5-spp', to: 'dark5-csp', series: 1, label: '1×1024×20²' },
      ],
    },
  },
};

export const MODEL_LEGEND: readonly NeatDiagramLegendItem[] = [
  { series: 1, label: 'feature maps' },
  { series: 4, label: 'predictions' },
  { series: 3, label: 'boxes' },
];

/** What the tip of an edge of the model graph says, by its id; an edge without one shows none. */
export const MODEL_EDGE_TIPS: Readonly<Record<string, string>> = {
  'input-stem': 'The camera frame, letterboxed to 640 × 640',
  'stages-head': 'Three feature maps, at strides 8, 16 and 32',
  'head-nms': 'Boxes, objectness and 80 class scores per cell',
  'dark4-dark5': 'The deepest stage: the coarsest map, the widest view',
};
