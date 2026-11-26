import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  NeatChatMessageFooter,
  NeatChatTranscript,
  type NeatChatMessage,
} from '@sima/neat-ui/chat';

/** The reply this example streams. */
const REPLY =
  'Three jars of dried pasta, a bottle of **olive oil** and canned tomatoes. Together that is most ' +
  'of a *pasta al pomodoro*: sauté the garlic in the oil, add the tomatoes, and let them simmer ' +
  'while the pasta boils.';

const PIECES = REPLY.match(/\s+|\S+/g) ?? [];

/**
 * A question with a picture and its reply streaming in, as the app writes it: the whole text so
 * far, once per piece. While the reply waits, the picture comes into focus as the board reads it
 * and an orb counts to the first word. Once it is done, the app's line under it gives the board's
 * figures. The picture's Expand shows it whole over the conversation. The conversation starts
 * again after a pause, with a new reply.
 *
 * @gallery
 * @animated
 */
@Component({
  selector: 'app-conversation',
  imports: [NeatChatTranscript, NeatChatMessageFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-conversation.example.html',
  styleUrl: './conversation.example.css',
})
export class Conversation {
  private readonly reply = signal<NeatChatMessage>({
    id: 'reply-1',
    role: 'assistant',
    text: '',
    state: 'waiting',
  });

  protected readonly messages = computed<NeatChatMessage[]>(() => [
    {
      id: 'q1',
      role: 'user',
      text: "What's on this shelf, and what could I cook with it?",
      pictures: [{ id: 'shelf', src: 'examples/shelf.webp', name: 'A kitchen shelf' }],
    },
    this.reply(),
  ]);

  constructor() {
    let tick = 0;
    let round = 1;
    const timer = setInterval(() => {
      tick++;
      const shown = tick - 10; // a first word after 0.4 s
      if (shown > 0 && shown <= PIECES.length) {
        this.reply.set({
          id: `reply-${round}`,
          role: 'assistant',
          text: PIECES.slice(0, shown).join(''),
          state: shown === PIECES.length ? 'done' : 'streaming',
        });
      } else if (shown > PIECES.length + 60) {
        tick = 0;
        round++;
        // A new reply, so the transcript sees it wait and reads the picture again.
        this.reply.set({ id: `reply-${round}`, role: 'assistant', text: '', state: 'waiting' });
      }
    }, 40);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
