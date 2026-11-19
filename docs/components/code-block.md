<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Code block

_Components › Data_ · [All topics](../README.md)

Code set apart on the muted fill, as written, with an optional Copy button at its end.

```html
<neat-code-block [code]="command" copy="install command" />
```

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/code-block/install-command.dark.webp">
<img src="../images/code-block/install-command.light.webp" alt="Code block: Install command" width="900">
</picture>

```ts
import { NeatCodeBlock, NeatCopyButton, provideNeatCodeLanguages } from '@sima/neat-ui/code-block';
```

## Examples

### Install command

A command to run, with a Copy button named "Copy install command". A long command wraps.

Press Copy, then paste the command somewhere.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/code-block/install-command.dark.webp">
<img src="../images/code-block/install-command.light.webp" alt="Code block: Install command" width="900">
</picture>

<details>
<summary>Code</summary>

`1-install-command.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';

@Component({
  selector: 'app-install-command',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-install-command.example.html',
})
export class InstallCommand {
  protected readonly command = 'npm install ./vendor/sima-neat-ui-<version>.tgz';
}
```

`1-install-command.example.html`

```html
<neat-code-block [code]="command" copy="install command" />
```

</details>

### Whole file

A whole file, its lines and indents as written. With `overflow="scroll"` a long line keeps its shape, and the block scrolls sideways.

Make the window narrow and scroll the code.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/code-block/whole-file.dark.webp">
<img src="../images/code-block/whole-file.light.webp" alt="Code block: Whole file" width="900">
</picture>

<details>
<summary>Code</summary>

`2-whole-file.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';

const APP_CONFIG = `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNeatTitles, provideNeatUi } from '@sima/neat-ui';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideNeatUi(), provideNeatTitles('Streams')],
};
`;

@Component({
  selector: 'app-whole-file',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-whole-file.example.html',
})
export class WholeFile {
  protected readonly file = APP_CONFIG;
}
```

`2-whole-file.example.html`

```html
<neat-code-block [code]="file" copy="app.config.ts" overflow="scroll" />
```

</details>

### Python file

A Python file in the theme's code colors: `language="python"` names its language. The highlighter and the Python grammar load the first time a block shows Python, and until they are there the block shows the code plain, in the same lines.

Switch the theme to see the colors in both schemes, then press Copy: it copies the file as given.

<details>
<summary>Code</summary>

`3-python-file.example.ts`

```ts
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

@Component({
  selector: 'app-python-file',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-python-file.example.html',
})
export class PythonFile {
  protected readonly file = RUN_MODEL;
}
```

`3-python-file.example.html`

```html
<neat-code-block [code]="file" language="python" copy="run_model.py" overflow="scroll" />
```

</details>

### Line numbers

A C++ file with its lines numbered: `[lineNumbers]="true"` adds a gutter as wide as the last number. The numbers are not part of the text.

Select a few lines and paste them somewhere: the numbers stay behind.

<details>
<summary>Code</summary>

`4-line-numbers.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';

const RUN_MODEL = `// Run a ResNet-50 model on one image with Neat.
#include "neat.h"

#include <opencv2/core.hpp>

#include <iostream>
#include <vector>

int main(int argc, char** argv) {
  if (argc < 2) {
    std::cerr << "Usage: run_model <model.tar.gz>\\n";
    return 1;
  }
  simaai::neat::Model::Options options;
  options.preprocess.kind = simaai::neat::InputKind::Image;
  options.preprocess.input_max_width = 224;
  options.preprocess.input_max_height = 224;
  options.preprocess.preset = simaai::neat::NormalizePreset::ImageNet;

  simaai::neat::Model model(argv[1], options);
  cv::Mat input(224, 224, CV_8UC3, cv::Scalar(99, 99, 99));  // a gray test frame
  simaai::neat::TensorList outputs = model.run(std::vector<cv::Mat>{input}, /*timeout_ms=*/2000);

  std::cout << "outputs: " << outputs.size() << "\\n";
  return 0;
}
`;

@Component({
  selector: 'app-line-numbers',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-line-numbers.example.html',
})
export class LineNumbers {
  protected readonly file = RUN_MODEL;
}
```

`4-line-numbers.example.html`

```html
<neat-code-block
  [code]="file"
  language="cpp"
  [lineNumbers]="true"
  copy="run_model.cpp"
  overflow="scroll"
/>
```

</details>

### Another language

A language the kit does not color by itself, a diff, added with [`provideNeatCodeLanguages`](../components/code-block.md#provideneatcodelanguages). Its grammar comes from Shiki's `@shikijs/langs` as a dynamic import, so it loads only when a block shows a diff.

Here the example's own `providers` add it for the blocks in its template. An app that shows diffs on many pages adds it in its `app.config.ts` instead.

<details>
<summary>Code</summary>

`5-another-language.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock, provideNeatCodeLanguages } from '@sima/neat-ui/code-block';

const CHANGE = `--- a/run_model.py
+++ b/run_model.py
@@ -21,5 +21,5 @@
 model = pyneat.Model(MODEL, build_options(224))
 image = np.full((224, 224, 3), 99, dtype=np.uint8)  # a gray test frame
 tensor = pyneat.Tensor.from_numpy(image, copy=True, image_format=pyneat.PixelFormat.RGB)
-outputs = model.run([tensor], timeout_ms=2000)
+outputs = model.run([tensor], timeout_ms=500)
 print(f"top1={int(np.argmax(outputs[0].to_numpy()))}")
`;

@Component({
  selector: 'app-another-language',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideNeatCodeLanguages({ diff: () => import('@shikijs/langs/diff') })],
  templateUrl: './5-another-language.example.html',
})
export class AnotherLanguage {
  protected readonly change = CHANGE;
}
```

`5-another-language.example.html`

```html
<neat-code-block [code]="change" language="diff" copy="change" overflow="scroll" />
```

</details>

### Marks on a pipeline

Marks on a C++ pipeline: `marks` bands the lines that compose it, marks the calls that build and run it, and dims the rest. Lines count from 1, as their numbers show, and a part of a line is named by its text.

Select the code and paste it somewhere, or press Copy: the marks change nothing of the text.

<details>
<summary>Code</summary>

`6-marks-on-a-pipeline.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock, type NeatCodeMark } from '@sima/neat-ui/code-block';

const DETECT_STREAM = `// Run a detector on an RTSP stream with Neat: decode, infer, pull the results.
#include "neat.h"

#include <iostream>

int main() {
  simaai::neat::Model model("/data/models/yolo_v8n.tar.gz");

  simaai::neat::nodes::groups::RtspDecodedInputOptions rtsp;
  rtsp.url = "rtsp://neat.local:8554/src3";
  rtsp.codec = simaai::neat::nodes::groups::RtspCodec::H264;
  rtsp.tcp = true;

  simaai::neat::Graph graph;
  graph.add(simaai::neat::nodes::groups::RtspDecodedInput(rtsp));
  graph.add(model);
  graph.add(simaai::neat::nodes::Output());
  auto run = graph.build(simaai::neat::RunOptions{});

  for (int i = 0; i < 100; ++i) {
    auto sample = run.pull(/*timeout_ms=*/5000);
    if (!sample.has_value()) break;
    const auto tensors = simaai::neat::tensors_from_sample(*sample, true);
    std::cout << "frame " << i << ": " << tensors.size() << " outputs\\n";
  }
  return 0;
}
`;

@Component({
  selector: 'app-marks-on-a-pipeline',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './6-marks-on-a-pipeline.example.html',
})
export class MarksOnAPipeline {
  protected readonly file = DETECT_STREAM;
  protected readonly marks: readonly NeatCodeMark[] = [
    { lines: [14, 17] },
    { line: 18, text: 'graph.build' },
    { line: 21, text: 'run.pull' },
  ];
}
```

`6-marks-on-a-pipeline.example.html`

```html
<neat-code-block
  [code]="file"
  language="cpp"
  [lineNumbers]="true"
  [marks]="marks"
  copy="detect_stream.cpp"
  overflow="scroll"
/>
```

</details>

### Step by step

A walk through a short Python Neat example, a set of marks at a time: `steps` gives each step's marks and label, and `[(step)]` binds the step shown, so the page shows that step's note beside the code. `stepControls` adds Previous, Next and the position under the code.

Press Next, or focus the block and press the left and right arrow keys.

<details>
<summary>Code</summary>

`7-step-by-step.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatCodeBlock, type NeatCodeStep } from '@sima/neat-ui/code-block';

const BUILD_GRAPH = `import numpy as np
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
interface Step extends NeatCodeStep {
  readonly label: string;
  readonly note: string;
}

const STEPS: readonly Step[] = [
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

@Component({
  selector: 'app-step-by-step',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './7-step-by-step.example.html',
  styleUrl: './step-by-step.example.css',
})
export class StepByStep {
  protected readonly file = BUILD_GRAPH;
  protected readonly steps = STEPS;
  protected readonly step = signal(0);
}
```

`7-step-by-step.example.html`

```html
<div class="walk">
  <neat-code-block
    [code]="file"
    language="python"
    [lineNumbers]="true"
    [steps]="steps"
    [(step)]="step"
    stepControls
    copy="build_graph.py"
    overflow="scroll"
  />
  <div class="note">
    <p class="label">{{ steps[step()].label }}</p>
    <p>{{ steps[step()].note }}</p>
  </div>
</div>
```

`step-by-step.example.css`

```css
/* The code and the step's note side by side, the note below the code where they do not fit. */
.walk {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--neat-space-4);
}

.walk neat-code-block {
  flex: 2 1 28rem;
}

.note {
  flex: 1 1 12rem;
  font-size: var(--neat-text-sm);
}

.note p {
  margin: 0 0 var(--neat-space-2);
}

.label {
  font-weight: 600;
}
```

</details>

### Marks on plain code

Marks on code without a language, a terminal session: the stream's protocol, the frames asked for, and the line where the stream stopped. Marked text is in the text color, and the rest dims to the muted one.

Text that comes more than once on its line takes columns, counted from 1: "rtsp" is in the program's name too, so `{ line: 1, from: 44, to: 47 }` marks the URL's.

<details>
<summary>Code</summary>

`8-marks-on-plain-code.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock, type NeatCodeMark } from '@sima/neat-ui/code-block';

const SESSION = `$ ./tutorial_018_consume_rtsp_stream --url rtsp://neat.local:8554/src3 --frames 4
frame=0 shape=[1080, 1920, 3]
frame=1 shape=[1080, 1920, 3]
frame=2 shape=[1080, 1920, 3]
frame=3 rtsp_timeout
`;

@Component({
  selector: 'app-marks-on-plain-code',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './8-marks-on-plain-code.example.html',
})
export class MarksOnPlainCode {
  protected readonly session = SESSION;
  protected readonly marks: readonly NeatCodeMark[] = [
    { line: 1, from: 44, to: 47 },
    { line: 1, text: '--frames 4' },
    { line: 5 },
  ];
}
```

`8-marks-on-plain-code.example.html`

```html
<neat-code-block [code]="session" [marks]="marks" copy="session" />
```

</details>

### Colored by the app

Code the app colored itself, as spans inside the block: runs from a highlighter of its own, as the showcase's snippets are colored at build time. They are shown in place of `code`, which spells the same text and stays what Copy copies. The spans take the theme's code colors, as `--neat-code-keyword` here. For code in a language the kit knows, `language` is simpler.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/code-block/colored-by-the-app.dark.webp">
<img src="../images/code-block/colored-by-the-app.light.webp" alt="Code block: Colored by the app" width="900">
</picture>

<details>
<summary>Code</summary>

`9-colored-by-the-app.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';

/** A stretch of code and the kind of text it is, as a highlighter gives them. */
interface Run {
  readonly kind: 'keyword' | 'string' | 'text';
  readonly text: string;
}

const RUNS: readonly Run[] = [
  { kind: 'keyword', text: 'const' },
  { kind: 'text', text: ' source = ' },
  { kind: 'string', text: "'rtsp://neat.local:8554/src3'" },
  { kind: 'text', text: ';' },
];

@Component({
  selector: 'app-colored-by-the-app',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './9-colored-by-the-app.example.html',
  styleUrl: './colored-by-the-app.example.css',
})
export class ColoredByTheApp {
  protected readonly runs = RUNS;
  protected readonly code = RUNS.map((run) => run.text).join('');
}
```

`9-colored-by-the-app.example.html`

```html
<neat-code-block [code]="code" copy="line">
  @for (run of runs; track $index) {
    <span [class]="run.kind">{{ run.text }}</span>
  }
</neat-code-block>
```

`colored-by-the-app.example.css`

```css
/* The theme's code colors, which keep 4.5:1 on the block's --muted fill in both schemes. */
.keyword {
  color: var(--neat-code-keyword);
}

.string {
  color: var(--neat-code-string);
}
```

</details>

### Stream URL

The Copy button on its own, beside a URL in running text. Its name is "Copy stream URL".

Press Copy, then paste the URL into a player.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/code-block/stream-url.dark.webp">
<img src="../images/code-block/stream-url.light.webp" alt="Code block: Stream URL" width="456">
</picture>

<details>
<summary>Code</summary>

`10-stream-url.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCode } from '@sima/neat-ui';
import { NeatCopyButton } from '@sima/neat-ui/code-block';

@Component({
  selector: 'app-stream-url',
  imports: [NeatCode, NeatCopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './10-stream-url.example.html',
  styleUrl: './stream-url.example.css',
})
export class StreamURL {
  protected readonly url = 'rtsp://neat.local:8554/src3';
}
```

`10-stream-url.example.html`

```html
<p class="url">
  The stream plays at <code neatCode>{{ url }}</code>
  <neat-copy-button [text]="url" what="stream URL" />
</p>
```

`stream-url.example.css`

```css
/* The sentence and its Copy button on one line, wrapping as one. */
.url {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--neat-space-2);
  margin: 0;
}
```

</details>

## API

### `NeatCodeBlock`

Component from `@sima/neat-ui/code-block`, selector `neat-code-block`.

For a command to run, a file to paste or a URL to copy. For a name or a path in running text, use `code[neatCode]` instead.

`copy` names what the code is and adds a [`NeatCopyButton`](../components/code-block.md#neatcopybutton) beside the code. "install command" names the button "Copy install command". Without `copy` the block has no button.

`overflow` is `wrap` by default, for short code such as a command, which then breaks anywhere. Use `scroll` for a whole file, whose lines keep their shape and scroll sideways.

`language` colors the code in the theme's code colors:

```html
<neat-code-block [code]="source" language="python" copy="example" overflow="scroll" />
```

The block colors Python, C++, C, shell, JSON, YAML, CMake, TypeScript, JavaScript, HTML, CSS, Markdown, Dockerfile and Go by themselves; [`provideNeatCodeLanguages`](../components/code-block.md#provideneatcodelanguages) adds others. The highlighter (Shiki) and each language's grammar load the first time a block on the page shows that language, so a page without a colored block loads none of it, and one with Python only never loads C++. While they load, the block shows the code plain, in the same layout. A language the block does not know leaves the code plain and is named once in dev mode.

`lineNumbers` numbers the lines in a gutter at their start. The numbers are not part of the text: a selection leaves them out, a screen reader does not read them, and Copy copies the code as given, colored or not.

`marks` sets lines, or parts of lines, apart, and dims the rest of the code. A [`NeatCodeMark`](../components/code-block.md#neatcodemark) counts lines and columns from 1, as `lineNumbers` numbers them:

```html
<neat-code-block [code]="source" language="cpp" [marks]="marks" />
```

```ts
readonly marks: NeatCodeMark[] = [{ lines: [4, 6] }, { line: 9, text: 'model.run' }];
```

A marked line gets a band across the block, and a marked part a rounded marker behind it, both in the theme's mark tint (`--neat-code-mark`). Marked code keeps its colors, each held to 4.5:1 on the tint. The rest dims to the muted text color, which still reads at 4.5:1 on the block. `[dim]="false"` leaves the rest as it is.

A marked part is a `mark` element, which a screen reader announces as highlighted. Marks change nothing of the text: a selection and Copy take the code as given. A mark that names no line, or text its line does not have, throws in dev mode and is left out in production.

`steps` walks through the code a set of marks at a time, each a [`NeatCodeStep`](../components/code-block.md#neatcodestep) with an optional `label`. `step` is the one shown, from 0. Bind it both ways to show a note of your own beside the block:

```html
<neat-code-block [code]="source" [steps]="walk" [(step)]="at" stepControls />
<p>{{ walk[at()].note }}</p>
```

While a block has steps, it shows their marks and does not use `marks`. A `step` outside the steps shows the nearest one and is left as it is. `stepControls` adds a Previous and a Next button and the position ("2 of 5") below the code.

A block with steps is a tab stop, and the left and right arrow keys move to the step before and after. On the code itself, which is a tab stop of its own while it scrolls sideways, they scroll it instead. Moving to a step fades its marks in as the last ones fade out, at once under reduced motion. A polite live region says the step ("Step 2 of 5: Open the camera").

The block scrolls its own box, never the page, to bring the first mark into view when the marks shown change. Give the block a height or a `max-height`, and its code scrolls inside it: a long file then walks to a mark further down without moving the page.

An app that colors its code itself (spans from a highlighter run at build time) puts them inside the element. They are shown in place of the block's own lines, without `language`, `lineNumbers` or marks, and `code` stays what Copy copies, so they must spell the same text. The steps, their controls and the keys still work, so the app can mark its own spans by `step`:

```html
<neat-code-block [code]="source" copy="app.ts">
  @for (run of runs; track $index) {
    <span [class]="run.kind">{{ run.text }}</span>
  }
</neat-code-block>
```

Angular leaves out the line breaks between a template's elements, so only the spans' own text shows, as written.

**Inputs**

- **`code`** `string`, required

  The code, as text: shown, and copied by the Copy button.

- **`copy`** `string`

  What the code is, which adds a Copy button named after it ("Copy install command").

- **`overflow`** `NeatCodeOverflow`, default `'wrap'`

  Whether a long line wraps or scrolls sideways (a [`NeatCodeOverflow`](../components/code-block.md#neatcodeoverflow)).

- **`language`** `string | null`, default `null`

  The language the code is in, by its Shiki name or an alias (`"python"`, `"cpp"`, `"bash"`), which colors it; `null`, the default, shows it plain.

- **`lineNumbers`** `boolean`, default `false`

  Whether the lines are numbered, in a gutter that a selection and Copy leave out.

- **`marks`** `readonly NeatCodeMark[]`, default `[]`

  The lines and parts of lines the block sets apart (a [`NeatCodeMark`](../components/code-block.md#neatcodemark) each), counted from 1. Not used while the block has `steps`.

- **`dim`** `boolean`, default `true`, transform `booleanAttribute`

  Whether the code outside the marks dims while there are marks. On by default.

- **`steps`** `readonly NeatCodeStep[]`, default `[]`

  A walk through the code, a [`NeatCodeStep`](../components/code-block.md#neatcodestep) at a time, each with its own marks. While there are steps, the block is a tab stop whose arrow keys move between them.

- **`stepControls`** `boolean`, default `false`, transform `booleanAttribute`

  Whether Previous and Next buttons and the position ("2 of 5") show under the code.

**Models (two-way)**

- **`step`** `number`, default `0`

  The step shown, from 0: bind it both ways to follow the block, or to move it.

### `NeatCodeOverflow`

Type from `@sima/neat-ui/code-block`.

What a code block does with a line wider than itself: `wrap` breaks it, `scroll` keeps it whole and scrolls the block sideways.

```ts
type NeatCodeOverflow = 'wrap' | 'scroll'
```

### `NeatCodeMark`

Type from `@sima/neat-ui/code-block`.

A mark: lines, or a part of a line, that a code block sets apart while it dims the rest.

Lines and columns count from 1, as people read them: line 1 is the first line, as `lineNumbers` numbers it, and column 1 its first character (a tab counts as one). Ranges include both ends.

- `{ lines: [4, 6] }` marks lines 4 to 6 and `{ line: 9 }` line 9 alone, each with a band across the block.
- `{ line: 9, text: 'model.run' }` marks the first `model.run` on line 9, with a marker behind it.
- `{ line: 9, from: 12, to: 20 }` marks columns 12 to 20 of line 9, for text that comes more than once on its line.

```ts
type NeatCodeMark = | { readonly lines: readonly [from: number, to: number] }
  | { readonly line: number; readonly text?: string; readonly from?: never; readonly to?: never }
  | { readonly line: number; readonly from: number; readonly to: number; readonly text?: never }
```

### `NeatCodeStep`

Interface from `@sima/neat-ui/code-block`.

One step of a code block's steps: the marks it shows, and a short label that a screen reader hears when the block moves to it.

An app adds what it shows beside the block for each step (a note) to its own steps, which the block takes as they are:

```ts
interface Step extends NeatCodeStep {
  readonly note: string;
}
```

**Members**

- **`marks`** `readonly NeatCodeMark[]`

  The lines and parts of lines the step marks. A step with none shows the code undimmed.

- **`label`** `string`, optional

  What the step is about in a few words ("Open the camera"), said when the block moves to it.

### `NeatCopyButton`

Component from `@sima/neat-ui/code-block`, selector `neat-copy-button`.

A small Copy button that puts `text` on the clipboard and says whether it did.

```html
<code neatCode>{{ url }}</code>
<neat-copy-button [text]="url" what="stream URL" />
```

[`NeatCodeBlock`](../components/code-block.md#neatcodeblock) shows one beside its code. Use this part on its own for text shown some other way: a URL in running text, or code whose Copy button sits outside it (above a set of tabs).

After a click the button says "Copied", with a check, or "Could not copy". It says the same in a polite live region, and offers to copy again after 2.5 s.

Its accessible name is "Copy" and `what`: "Copy stream URL", so a page with several buttons does not read as a list of "Copy". The name starts with the visible caption, so a voice user can say what they see.

It needs a secure context. A browser gives the clipboard to pages served over https and from localhost only, so on a page served over plain http the button says it could not copy. It has no fallback.

**Inputs**

- **`text`** `string`, required

  The text the button copies.

- **`what`** `string`, required

  What the text is, for the button's name: `install command` names it "Copy install command".

### `provideNeatCodeLanguages`

Function from `@sima/neat-ui/code-block`.

Adds languages to the ones a code block colors by itself, or gives one another grammar.

```ts
providers: [
  provideNeatCodeLanguages({
    rust: () => import('@shikijs/langs/rust'),
    rs: () => import('@shikijs/langs/rust'),
  }),
],
```

Each key is a name a block's `language` takes, so a language used by two names (its id and an alias) is listed under both. The kit colors Python, C++, C, shell, JSON, YAML, CMake, TypeScript, JavaScript, HTML, CSS, Markdown, Dockerfile and Go without it.

It goes in any `providers`: the app's `app.config.ts` for every page, a route's for the pages under it, a component's for the blocks in its template. Each adds to the languages of the place around it, so a page's languages come on top of the app's. Within one `providers` list, call it once with all of that place's languages: a second call there replaces the first.

```ts
provideNeatCodeLanguages(languages: NeatCodeLanguages): Provider
```

### `NeatCodeLanguages`

Type from `@sima/neat-ui/code-block`.

The languages a code block can color, by the name its `language` takes: for each, a function that imports the language's grammar.

Each import names a grammar module of Shiki's `@shikijs/langs` package (the kit installs it with its highlighter), as a dynamic `import()`, so the grammar loads only when a block shows that language:

```ts
const languages: NeatCodeLanguages = {
  rust: () => import('@shikijs/langs/rust'),
  toml: () => import('@shikijs/langs/toml'),
};
```

A module's default export is the language's grammar after those it embeds, as `@shikijs/langs` gives it. A static import would put the grammar in the bundle of every page that imports the file.

```ts
type NeatCodeLanguages = Readonly<
  Record<string, () => Promise<{ readonly default: readonly object[] }>>
>
```
