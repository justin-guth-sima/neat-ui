import type { NeatDiagramLegendItem, NeatDiagramNode, NeatDiagramSet } from '@sima/neat-ui/diagram';
import { EV74, MLA } from './chips';

/*
 * A model graph, placed after the reference sheet: tensor shapes on the edges, a backbone, and
 * levels two deep.
 */

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
