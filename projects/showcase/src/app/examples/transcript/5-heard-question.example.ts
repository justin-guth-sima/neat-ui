import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NeatChatMessageFooter,
  NeatChatTranscript,
  type NeatChatMessage,
} from '@sima/neat-ui/chat';

/** The question as speech-to-text heard it. */
const HEARD = "What's on this shelf, and which of it would you cook with?";
/** How long each heard question stays before the next. */
const ROUND_MS = 3000;

/**
 * A heard question (`heard`, a question the visitor spoke) arriving in the transcript deciphered:
 * its letters come out of glyphs, again every few seconds. The bubble has its whole size from the
 * start.
 *
 * @animated
 */
@Component({
  selector: 'app-heard-question',
  imports: [NeatChatTranscript, NeatChatMessageFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './5-heard-question.example.html',
  styleUrl: './heard-question.example.css',
})
export class HeardQuestion {
  protected readonly messages = signal<NeatChatMessage[]>([]);

  constructor() {
    let round = 0;
    const ask = () => {
      // A new id each round: the transcript sees a new heard question arrive.
      this.messages.set([{ id: `heard-${round}`, role: 'user', text: HEARD, heard: true }]);
      round++;
    };
    // The first round starts after the transcript's first render, so its question arrives.
    let timer = setTimeout(ask, 100);
    const interval = setInterval(() => {
      clearTimeout(timer);
      timer = setTimeout(ask);
    }, ROUND_MS);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      clearInterval(interval);
    });
  }
}
