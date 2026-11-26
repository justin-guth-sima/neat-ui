import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NeatChatMessageFooter,
  NeatChatTranscript,
  type NeatChatMessage,
  type NeatListeningMotion,
} from '@sima/neat-ui/chat';

/** The question as speech-to-text heard it. */
const HEARD = "What's on this shelf, and which of it would you cook with?";
/** The motion the example arrives in: radial; in the message box needs the box's text area. */
const MOTION: NeatListeningMotion = 'radial';
/** How long each heard question stays before the next. */
const ROUND_MS = 3000;

const NAMES: Record<NeatListeningMotion, string> = {
  radial: 'Radial',
  'in-message-box': 'In the message box',
};

/**
 * A heard question (`heard`, a question the visitor spoke) arriving in the transcript's
 * `listeningMotion`: its words coming into focus one by one (radial), again every few seconds. The
 * bubble has its whole size from the start. In the message box, the text flies out of the box's
 * text area as its words come into focus.
 *
 * @animated
 */
@Component({
  selector: 'app-heard-question',
  imports: [NeatChatTranscript, NeatChatMessageFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-heard-question.example.html',
  styleUrl: './heard-question.example.css',
})
export class HeardQuestion {
  protected readonly motion = signal<NeatListeningMotion>(MOTION);
  protected readonly messages = signal<NeatChatMessage[]>([]);
  protected readonly names = NAMES;

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
