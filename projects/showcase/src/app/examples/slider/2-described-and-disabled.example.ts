import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatSlider } from '@sima/neat-ui/slider';

/** A slider described by the note beside it, and a disabled one. */
@Component({
  selector: 'app-described-and-disabled',
  imports: [NeatSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <span>Described</span>
      <neat-slider
        label="Gain"
        describedBy="gain-note"
        [min]="0"
        [max]="100"
        [step]="5"
        [(value)]="gain"
      />
      <span id="gain-note" class="showcase-muted"> <code>describedBy</code> names this note. </span>
    </div>
    <div class="field">
      <span>Disabled</span>
      <neat-slider label="Disabled" [min]="0" [max]="100" [step]="5" [value]="40" disabled />
    </div>
  `,
  styleUrls: ['./slider-field.css', './described-and-disabled.example.css'],
})
export class DescribedAndDisabled {
  protected readonly gain = signal(30);
}
