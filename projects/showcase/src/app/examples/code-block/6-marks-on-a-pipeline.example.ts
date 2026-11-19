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

/**
 * Marks on a C++ pipeline: `marks` bands the lines that compose it, marks the calls that build
 * and run it, and dims the rest. Lines count from 1, as their numbers show, and a part of a line
 * is named by its text.
 *
 * Select the code and paste it somewhere, or press Copy: the marks change nothing of the text.
 */
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
