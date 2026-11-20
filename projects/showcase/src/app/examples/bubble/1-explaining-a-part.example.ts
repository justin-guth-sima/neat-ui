import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatBubble } from '@sima/neat-ui/bubble';

/** A stage of the pipeline, with what its bubble says. */
interface Stage {
  readonly name: string;
  readonly note: string;
}

/**
 * A bubble that explains the stage of a pipeline the reader picks: its `anchor` is the stage's
 * button, so it moves from stage to stage, and null hides it. Each button points at the bubble with
 * `aria-describedby` while the bubble explains it, so a screen reader reads the note with it.
 *
 * Press a stage, and press it again to hide its note.
 *
 * @play click .stages button:nth-child(2)
 * @play wait 300
 */
@Component({
  selector: 'app-explaining-a-part',
  imports: [NeatBubble, NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-explaining-a-part.example.html',
  styleUrl: './bubble.example.css',
})
export class ExplainingAPart {
  protected readonly stages: readonly Stage[] = [
    { name: 'Camera', note: 'Decodes the camera’s H.264 stream into frames.' },
    { name: 'Detector', note: 'Runs the model on the MLA and finds the objects in each frame.' },
    { name: 'Display', note: 'Draws the boxes over the frame and sends it to Insight.' },
  ];
  /** The stage explained and its button, which the bubble points at; null for none. */
  protected readonly explained = signal<{ stage: Stage; button: HTMLElement } | null>(null);

  protected toggle(stage: Stage, button: HTMLElement): void {
    this.explained.set(this.explained()?.stage === stage ? null : { stage, button });
  }
}
