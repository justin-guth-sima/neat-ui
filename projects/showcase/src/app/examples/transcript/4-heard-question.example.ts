import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NeatChatMessageFooter,
  NeatChatTranscript,
  type NeatChatMessage,
  type NeatListeningMotion,
} from '@sima/neat-ui/chat';

/** The question as speech-to-text heard it. */
const HEARD = "What's on this shelf, and which of it would you cook with?";
/** The motions the example arrives in, in turn; in the message box needs the box's text area. */
const MOTIONS: readonly NeatListeningMotion[] = ['ring-and-waveform', 'radial'];
/** How long each heard question stays before the next. */
const ROUND_MS = 3000;

const NAMES: Record<NeatListeningMotion, string> = {
  level: 'Level',
  'ring-and-waveform': 'Ring and waveform',
  radial: 'Radial',
  'in-message-box': 'In the message box',
};

/**
 * A heard question (`heard`, a question the visitor spoke) arriving in the transcript's
 * `listeningMotion`: its letters decrypting out of glyphs (ring and waveform), or its words coming
 * into focus one by one (radial), in turn. The bubble has its whole size from the start. In the
 * message box, the text flies out of the box's text area instead; with `level` it shows plain.
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
  protected readonly motion = signal<NeatListeningMotion>(MOTIONS[0]);
  protected readonly messages = signal<NeatChatMessage[]>([]);
  protected readonly names = NAMES;

  constructor() {
    let round = 0;
    const ask = () => {
      this.motion.set(MOTIONS[round % MOTIONS.length]);
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
