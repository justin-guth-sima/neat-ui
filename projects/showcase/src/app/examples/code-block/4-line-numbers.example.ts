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

/**
 * A C++ file with its lines numbered: `[lineNumbers]="true"` adds a gutter as wide as the last
 * number. The numbers are not part of the text.
 *
 * Select a few lines and paste them somewhere: the numbers stay behind.
 */
@Component({
  selector: 'app-line-numbers',
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-line-numbers.example.html',
})
export class LineNumbers {
  protected readonly file = RUN_MODEL;
}
