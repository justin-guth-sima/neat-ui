import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';

const RUN_MODEL = `"""Run a ResNet-50 model on one image with pyneat."""
from pathlib import Path

import numpy as np
import pyneat

MODEL = Path("/data/models/resnet_50.tar.gz")


def build_options(size: int) -> pyneat.ModelOptions:
    options = pyneat.ModelOptions()
    options.preprocess.kind = pyneat.InputKind.Image
    options.preprocess.input_max_width = size
    options.preprocess.input_max_height = size
    options.preprocess.preset = pyneat.NormalizePreset.ImageNet
    return options


model = pyneat.Model(MODEL, build_options(224))
image = np.full((224, 224, 3), 99, dtype=np.uint8)  # a gray test frame
tensor = pyneat.Tensor.from_numpy(image, copy=True, image_format=pyneat.PixelFormat.RGB)
outputs = model.run([tensor], timeout_ms=2000)
print(f"top1={int(np.argmax(outputs[0].to_numpy()))}")
`;

/**
 * A Python file in the theme's code colors: `language="python"` names its language. The
 * highlighter and the Python grammar load the first time a block shows Python, and until they are
 * there the block shows the code plain, in the same lines.
 *
 * Switch the theme to see the colors in both schemes, then press Copy: it copies the file as given.
 */
@Component({
  selector: 'app-python-file',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-python-file.example.html',
})
export class PythonFile {
  protected readonly file = RUN_MODEL;
}
