import type { NeatDiagramLegendItem, NeatDiagramSet } from '@sima/neat-ui/diagram';
import { MLA } from './badges';

/*
 * A compile flow, placed after the reference sheet: a column of steps, with an input beside it and
 * an optional step.
 */

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
      {
        id: 'compile',
        role: 'block',
        label: 'Compile',
        badges: [MLA],
        x: 0,
        y: 240,
        w: 150,
        h: 46,
      },
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
