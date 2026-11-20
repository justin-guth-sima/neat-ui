import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';
import { BUILD_GRAPH, STEPS } from './build-graph';

/**
 * A walk through a short Python Neat example, a set of marks at a time: `steps` gives each step's
 * marks and label, and `[(step)]` binds the step shown, so the page shows that step's note beside
 * the code. `stepControls` adds Previous, Next and the position under the code.
 *
 * Press Next, or focus the block and press the left and right arrow keys.
 */
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
