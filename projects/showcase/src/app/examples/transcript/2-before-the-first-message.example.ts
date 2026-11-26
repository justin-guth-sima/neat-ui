import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatChatTranscript } from '@sima/neat-ui/chat';

/**
 * Before the first message the transcript says there are none yet: the no-messages icon, large and
 * muted, over `emptyTitle` and the app's `emptyHint`, how to begin. Only the app knows whether the
 * visitor can also speak, so the hint is its own.
 */
@Component({
  selector: 'app-before-the-first-message',
  imports: [NeatChatTranscript],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-before-the-first-message.example.html',
  styleUrl: './before-the-first-message.example.css',
})
export class BeforeTheFirstMessage {}
