import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { NeatMarkdown, neatSpeakable } from '@sima/neat-ui/markdown';

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
 * The sentences read aloud would speak (`neatSpeakable`) while a reply streams: each sentence's
 * words without the Markdown, and its range in the text. A sentence is complete (✓) once
 * whitespace or another block follows it, so an app can speak it then; the code is never read.
 *
 * @animated
 */
@Component({
  selector: 'app-read-aloud',
  imports: [NeatMarkdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-read-aloud.example.html',
  styleUrl: './read-aloud.example.css',
})
export class ReadAloud {
  protected readonly text = signal('');
  protected readonly streaming = signal(true);
  protected readonly sentences = computed(() =>
    neatSpeakable(this.text(), { final: !this.streaming() }),
  );

  constructor() {
    let shown = 0;
    let pause = 0;
    const timer = setInterval(() => {
      if (shown < PIECES.length) {
        this.text.update((text) => text + PIECES[shown++]);
        if (shown === PIECES.length) this.streaming.set(false);
      } else if (++pause > 75) {
        shown = 0;
        pause = 0;
        this.text.set('');
        this.streaming.set(true);
      }
    }, 40);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
