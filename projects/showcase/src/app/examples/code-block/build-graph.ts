import type { NeatCodeStep } from '@sima/neat-ui/code-block';

/** A short Python Neat example: describe a frame, compose a graph, build it and run a frame. */
export const BUILD_GRAPH = `import numpy as np
import pyneat

inp = pyneat.InputOptions()
inp.format = pyneat.Format.RGB
inp.width = 320
inp.height = 240
inp.depth = 3

graph = pyneat.Graph()
graph.add(pyneat.nodes.input(inp))
graph.add(pyneat.nodes.output())

rgb = np.full((240, 320, 3), 33, dtype=np.uint8)
tensor = pyneat.Tensor.from_numpy(rgb, copy=True, image_format=pyneat.PixelFormat.RGB)
run = graph.build([tensor])

outputs = run.run([tensor], timeout_ms=1000)
print(f"output_rank={len(outputs[0].shape)}")
`;

/** A step of the walk, with the note the page shows beside the code. */
export interface Step extends NeatCodeStep {
  readonly label: string;
  readonly note: string;
}

export const STEPS: readonly Step[] = [
  {
    label: 'Describe the input',
    marks: [{ lines: [4, 8] }],
    note: 'InputOptions says what a frame looks like: its pixel format, width, height and depth. The input node checks each frame against it.',
  },
  {
    label: 'Compose the graph',
    marks: [{ lines: [10, 12] }],
    note: 'A Graph is a description. add() appends nodes in order: here an input node and an output node, with nothing between them yet.',
  },
  {
    label: 'Build the pipeline',
    marks: [
      { line: 15, text: 'Tensor.from_numpy' },
      { line: 16, text: 'graph.build' },
    ],
    note: 'build() turns the description into a Run, which it can do only with a sample frame: a Tensor made from a NumPy array.',
  },
  {
    label: 'Run a frame',
    marks: [
      { line: 18, text: 'run.run' },
      { line: 19, text: 'outputs[0].shape' },
    ],
    note: 'run() pushes one frame and pulls one result. With no model in the graph, the result has the input’s rank, which shows the frame went through.',
  },
];
