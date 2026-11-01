import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatSlider } from '@sima/neat-ui/slider';

/** An opacity slider with its value beside it: drag, and the number follows every step. */
@Component({
  selector: 'app-live-value',
  imports: [NeatSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <span>Opacity</span>
      <neat-slider label="Opacity" [min]="0" [max]="100" [step]="5" [(value)]="opacity" />
      <span class="showcase-code showcase-muted">{{ opacity() }} %</span>
    </div>
  `,
  styleUrl: './slider-field.css',
})
export class LiveValue {
  protected readonly opacity = signal(60);
}
