import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { NeatScore, NeatScoreBars, neatLabelColour } from '@sima/neat-ui/charts';
import { CLASSES, NO_GESTURE, scoresAt } from './data';

/**
 * The output of a gesture classifier, a score per IPN Hand class. The scores change every 1.5 s;
 * "No gesture" is `quiet`, so it stays muted beside the coloured gestures, and the top row's label
 * is bold. The line below the bars colours its dot with `neatLabelColour`, so text outside the
 * bars (a timeline's runs, a caption) shows a class in the same colour.
 */
@Component({
  selector: 'app-gesture-scores',
  imports: [NeatScoreBars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-score-bars
      label="Gesture probabilities"
      [scores]="scores()"
      [labels]="labels"
      [quiet]="quiet"
    />
    <p class="reading">
      <span class="dot" [style.background]="topColour()"></span>
      {{ top().label }}
    </p>
  `,
  styleUrl: './gesture-scores.example.css',
})
export class GestureScores {
  protected readonly labels = CLASSES;
  protected readonly quiet = [NO_GESTURE];
  protected readonly scores = signal<readonly NeatScore[]>(scoresAt(0));
  protected readonly top = computed(() =>
    this.scores().reduce((best, score) => (score.value > best.value ? score : best)),
  );
  protected readonly topColour = computed(() =>
    neatLabelColour(this.top().label, this.labels, this.quiet),
  );

  constructor() {
    let step = 0;
    const timer = setInterval(() => this.scores.set(scoresAt(++step)), 1500);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
