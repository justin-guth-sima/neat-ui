import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatChatErrorActions, NeatChatTranscript, type NeatChatMessage } from '@sima/neat-ui/chat';

/** A conversation that holds every state a reply has. */
const CONVERSATION: NeatChatMessage[] = [
  { id: 'q1', role: 'user', text: 'Describe the picture in detail.' },
  { id: 'a1', role: 'assistant', text: 'A kitchen shelf with three jars of', state: 'stopped' },
  { id: 'q2', role: 'user', text: 'And now in one sentence?' },
  {
    id: 'a2',
    role: 'assistant',
    text: '',
    state: 'error',
    error: 'The conversation is too long for the model. Start a new chat to go on.',
  },
  { id: 'q3', role: 'user', text: 'What do you see?' },
  { id: 'a3', role: 'assistant', text: '', state: 'waiting' },
];

/**
 * The other states of a reply: one the visitor stopped, one that failed, with the app's New chat
 * button in its callout, and one still waiting for its first word.
 */
@Component({
  selector: 'app-states',
  imports: [NeatButton, NeatChatErrorActions, NeatChatTranscript],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-states.example.html',
  styleUrl: './states.example.css',
})
export class States {
  protected readonly messages = signal<NeatChatMessage[]>(CONVERSATION);

  protected newChat(): void {
    this.messages.set([]);
    setTimeout(() => this.messages.set(CONVERSATION), 1500);
  }
}
