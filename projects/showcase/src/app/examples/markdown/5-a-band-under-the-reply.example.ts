import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NeatMarkdown, type NeatCloudBox } from '@sima/neat-ui/markdown';

/** The reply this example streams, a piece at a time. */
const REPLY = `Three jars of **dried pasta**, a bottle of olive oil and canned tomatoes. Together that is
most of a *pasta al pomodoro*: sauté the garlic in the oil, add the tomatoes, and let them simmer
while the pasta boils.`;

/** The reply's pieces: each word and each run of spaces, as a model's tokens arrive. */
const PIECES = REPLY.match(/\s+|\S+/g) ?? [];

/**
 * The word cloud as a band as wide as the reply: `cloudBox` gives a box of a width, a height and
 * an offset from the newest piece, and `width: 'full'` spans the reply and stands still sideways
 * while the box steps down with the text. Here the band is 48 px high, 40 px below each line. The
 * default box is a 240 by 64 px patch that follows the newest piece along its line, which
 * `NEAT_CLOUD_BOX` holds. Under reduced motion the reply is plain. It starts again after a pause.
 *
 * @animated
 */
@Component({
  selector: 'app-a-band-under-the-reply',
  imports: [NeatMarkdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './5-a-band-under-the-reply.example.html',
  styleUrl: './a-band-under-the-reply.example.css',
})
export class ABandUnderTheReply {
  protected readonly box: NeatCloudBox = { width: 'full', height: 48, x: 0, y: 40 };
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
    }, 55);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
