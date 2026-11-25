import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NeatMessageBox,
  type NeatChatDraft,
  type NeatMessageBoxActivity,
} from '@sima/neat-ui/chat';

/** How long the example's pretend board spends on each activity, in ms. */
const PHASES: readonly (readonly [NeatMessageBoxActivity, number])[] = [
  ['idle', 800],
  ['waiting', 1200],
  ['streaming', 2000],
];

/**
 * The message box while a pretend board works through a question again and again: the comet runs
 * round its edge until the first word and faster while the reply arrives, and Send turns into Stop
 * meanwhile. Type a question and press Enter, or drop a picture on the box.
 *
 * @animated
 */
@Component({
  selector: 'app-message-box',
  imports: [NeatMessageBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-message-box.example.html',
  styleUrl: './message-box.example.css',
})
export class MessageBox {
  protected readonly activity = signal<NeatMessageBoxActivity>('idle');
  protected readonly sent = signal<NeatChatDraft[]>([]);

  constructor() {
    let phase = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      this.activity.set(PHASES[phase][0]);
      timer = setTimeout(next, PHASES[phase][1]);
      phase = (phase + 1) % PHASES.length;
    };
    next();
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  protected onSend(draft: NeatChatDraft): void {
    this.sent.update((sent) => [...sent, draft]);
  }
}
