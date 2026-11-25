import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NEAT_TEXT_MOTIONS, NeatMarkdown, type NeatTextMotion } from '@sima/neat-ui/markdown';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';
import { NeatSlider } from '@sima/neat-ui/slider';

/** The reply this example streams, a piece at a time. */
const REPLY = `Three jars of **dried pasta**, a bottle of olive oil and canned tomatoes. Together that is
most of a *pasta al pomodoro*: sauté the garlic in the oil, add the tomatoes, and let them simmer
while the pasta boils.`;

/** The reply's pieces: each word and each run of spaces, as a model's tokens arrive. */
const PIECES = REPLY.match(/\s+|\S+/g) ?? [];

/** Each motion's name in words, for the picker. */
const NAMES: Record<NeatTextMotion, string> = {
  plain: 'Plain',
  focus: 'Focus',
  'heat-trail': 'Heat trail',
  decrypt: 'Decrypt',
  'reverse-explosion': 'Reverse explosion',
  'token-flash': 'Token flash',
  'drop-in': 'Drop-in',
  'word-cloud': 'Word cloud',
};

/**
 * A reply streaming in each of the kit's text motions: pick one, and the pieces per second the
 * model writes. Each piece moves for a moment, then settles into plain text; under reduced motion
 * every motion is plain. It starts again after a pause.
 *
 * @animated
 * @hide .controls
 */
@Component({
  selector: 'app-text-motion',
  imports: [NeatMarkdown, NeatSelect, NeatSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-text-motion.example.html',
  styleUrl: './text-motion.example.css',
})
export class TextMotion {
  protected readonly motions: NeatSelectOption<NeatTextMotion>[] = NEAT_TEXT_MOTIONS.map(
    (motion) => ({ value: motion, label: NAMES[motion] }),
  );
  protected readonly motion = signal<NeatTextMotion | null>('heat-trail');
  protected readonly piecesPerSecond = signal(18);
  protected readonly text = signal('');
  protected readonly streaming = signal(true);

  constructor() {
    let shown = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      if (shown < PIECES.length) {
        this.text.update((text) => text + PIECES[shown++]);
        if (shown === PIECES.length) this.streaming.set(false);
        timer = setTimeout(next, 1000 / this.piecesPerSecond());
      } else {
        // A pause after the reply, then it starts again.
        timer = setTimeout(() => {
          shown = 0;
          this.text.set('');
          this.streaming.set(true);
          next();
        }, 2000);
      }
    };
    timer = setTimeout(next, 0);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
