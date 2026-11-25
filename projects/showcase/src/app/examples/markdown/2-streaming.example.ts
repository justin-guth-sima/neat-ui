import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NeatMarkdown } from '@sima/neat-ui/markdown';

/** The reply this example streams, a piece at a time. */
const REPLY = `Three jars of **dried pasta**, a bottle of olive oil and canned tomatoes. Together that is
most of a *pasta al pomodoro*:

1. Sauté the garlic in the oil.
2. Add the tomatoes and let them simmer.

\`\`\`python
minutes = 15
\`\`\``;

/** The reply's pieces: each word and each run of spaces, as a model's tokens arrive. */
const PIECES = REPLY.match(/\s+|\S+/g) ?? [];

/**
 * A reply streaming in at 25 pieces a second, as a model writes it: half-written marks show as
 * they will end, so `**dried` is bold at once and the code block grows, and a caret ends the text
 * until the reply is done. It starts again after a pause.
 *
 * @animated
 */
@Component({
  selector: 'app-streaming',
  imports: [NeatMarkdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-streaming.example.html',
  styleUrl: './streaming.example.css',
})
export class Streaming {
  protected readonly text = signal('');
  protected readonly streaming = signal(true);

  constructor() {
    let shown = 0;
    let pause = 0;
    const timer = setInterval(() => {
      if (shown < PIECES.length) {
        this.text.update((text) => text + PIECES[shown++]);
        if (shown === PIECES.length) this.streaming.set(false);
      } else if (++pause > 50) {
        shown = 0;
        pause = 0;
        this.text.set('');
        this.streaming.set(true);
      }
    }, 40);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
