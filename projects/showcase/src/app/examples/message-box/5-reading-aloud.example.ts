import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NeatMessageBox, type NeatMessageBoxActivity } from '@sima/neat-ui/chat';

/** The pretend reply's rounds: what the board does, whether the app reads aloud, and for how long. */
const PHASES: readonly (readonly [NeatMessageBoxActivity, boolean, number])[] = [
  ['streaming', true, 2000],
  ['idle', true, 2000],
  ['idle', false, 1000],
];

/**
 * While the app reads a reply aloud (`speaking`), Stop reading aloud stands before Send, or before
 * Stop while the reply still arrives. It ends the reading only (`stopSpeaking`); Stop ends the
 * reply. Two buttons with two icons, so silencing the voice never stops the reply by surprise.
 *
 * @animated
 */
@Component({
  selector: 'app-reading-aloud',
  imports: [NeatMessageBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './5-reading-aloud.example.html',
  styleUrl: './message-box.example.css',
})
export class ReadingAloud {
  protected readonly activity = signal<NeatMessageBoxActivity>('idle');
  protected readonly speaking = signal(false);

  constructor() {
    let phase = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      const [activity, speaking, ms] = PHASES[phase];
      this.activity.set(activity);
      this.speaking.set(speaking);
      timer = setTimeout(next, ms);
      phase = (phase + 1) % PHASES.length;
    };
    next();
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
