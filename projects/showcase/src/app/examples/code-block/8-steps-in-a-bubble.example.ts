import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCodeBlock, NeatCodeNote } from '@sima/neat-ui/code-block';
import { BUILD_GRAPH, STEPS } from './build-graph';

/**
 * The same walk with each step's note in a bubble beside its marks instead of beside the block: a
 * `neatCodeNote` template inside the block gives the note, and the block shows it in a
 * `NeatBubble` that moves with the step. The template is given the step as the app wrote it, so
 * `step.note` is the app's own field. The bubble sits above the marks, or below where there is no
 * room above; `neatCodeNoteSide` prefers another side.
 *
 * Press Next, or focus the block and press the left and right arrow keys.
 *
 * @play wait 300
 */
@Component({
  selector: 'app-steps-in-a-bubble',
  imports: [NeatCodeBlock, NeatCodeNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './8-steps-in-a-bubble.example.html',
})
export class StepsInABubble {
  protected readonly file = BUILD_GRAPH;
  protected readonly steps = STEPS;
}
