import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatLevelMeter } from '@sima/neat-ui/level-meter';

/** A meter fed a sine wave, as a microphone test is fed a level. Stop passes `null`: it goes dark. */
@Component({
  selector: 'app-sine-wave',
  imports: [NeatButton, NeatLevelMeter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-level-meter [sample]="running() ? sineLevel : null" />
    <button neatButton type="button" size="small" (click)="running.update((on) => !on)">
      {{ running() ? 'Stop' : 'Start' }}
    </button>
  `,
  styleUrl: './sine-wave.example.css',
})
export class SineWave {
  protected readonly running = signal(true);
  /** Swings from -50 to 0 dBFS and back about every four seconds. */
  protected readonly sineLevel = () => -25 + 25 * Math.sin(performance.now() / 600);
}
