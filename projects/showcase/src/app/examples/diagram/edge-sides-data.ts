import type { NeatDiagramLegendItem, NeatDiagramSet } from '@sima/neat-ui/diagram';

/*
 * A source that sends to a display and to an archive. Both edges leave the source on its `outSide`
 * (right) unless an edge says otherwise: the archive copy leaves on the source's bottom and enters
 * the archive on its left, with `fromSide` and `toSide` on that one edge.
 */

export const EDGE_SIDES: NeatDiagramSet = {
  overview: {
    nodes: [
      {
        id: 'source',
        role: 'block',
        label: 'Source',
        detail: 'outSide right',
        outSide: 'right',
        x: 0,
        y: 0,
        w: 150,
        h: 46,
      },
      { id: 'display', role: 'block', label: 'Display', x: 300, y: 0, w: 150, h: 46 },
      { id: 'archive', role: 'block', label: 'Archive', x: 300, y: 140, w: 150, h: 46 },
    ],
    edges: [
      { id: 'source-display', from: 'source', to: 'display', series: 1, label: 'frames' },
      {
        id: 'source-archive',
        from: 'source',
        to: 'archive',
        series: 2,
        label: 'archive copy',
        fromSide: 'bottom',
      },
    ],
  },
};

export const EDGE_SIDES_LEGEND: readonly NeatDiagramLegendItem[] = [
  { series: 1, label: 'Leaves on the node’s outSide' },
  { series: 2, label: 'Leaves on its own fromSide' },
];
