import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  NeatMarkdown,
  neatSpeakable,
  type NeatSpeakingMotion,
  type NeatSpeech,
} from '@sima/neat-ui/markdown';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';

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

/** How long a sentence takes to say: 55 ms a character, the mockup's pace. */
const MS_PER_CHARACTER = 55;
/** The pretend voice's sample rate. */
const SAMPLE_RATE = 16_000;

/**
 * A reply read aloud while it streams. The sentences read aloud would speak (`neatSpeakable`) are
 * each complete once whitespace or another block follows them, so an app can speak them then; the
 * code is never read. The example "speaks" each complete sentence in turn, in silence at the pace
 * of a voice, and the reply shows it in the chosen speaking motion (`speech`, `speakingMotion`).
 *
 * `neat-markdown` draws the `sentence` and the `equalizer` motions. The `waveform` is a strip under
 * the reply that the transcript draws, shown by the read-aloud example of `NeatChatTranscript`.
 *
 * @animated
 */
@Component({
  selector: 'app-read-aloud',
  imports: [NeatMarkdown, NeatSelect],
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
  protected readonly motions: readonly NeatSelectOption<NeatSpeakingMotion>[] = [
    { value: 'sentence', label: 'Sentence' },
    { value: 'equalizer', label: 'Equalizer' },
  ];
  protected readonly motion = signal<NeatSpeakingMotion | null>('equalizer');
  /** The sentence being said, as an app's read aloud sets it while its audio plays. */
  protected readonly speech = signal<NeatSpeech | null>(null);
  /** Where the sentences said so far end in the text. */
  private spokenTo = 0;
  private speaking: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    let shown = 0;
    let pause = 0;
    const timer = setInterval(() => {
      if (shown < PIECES.length) {
        this.text.update((text) => text + PIECES[shown++]);
        if (shown === PIECES.length) this.streaming.set(false);
      } else if (++pause > 200) {
        shown = 0;
        pause = 0;
        this.text.set('');
        this.streaming.set(true);
        this.stop();
      }
      this.speakNext();
    }, 40);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.stop();
    });
  }

  /** Says the next complete sentence once the one before has been said. */
  private speakNext(): void {
    if (this.speech()) return;
    const next = this.sentences().find((s) => s.complete && s.from >= this.spokenTo);
    if (!next) return;
    const ms = next.text.length * MS_PER_CHARACTER;
    this.spokenTo = next.to;
    this.speech.set({
      from: next.from,
      to: next.to,
      startedAt: performance.now(),
      audio: { samples: new Float32Array((ms / 1000) * SAMPLE_RATE), sampleRate: SAMPLE_RATE },
    });
    this.speaking = setTimeout(() => {
      this.speech.set(null);
      this.speakNext();
    }, ms);
  }

  private stop(): void {
    clearTimeout(this.speaking);
    this.speech.set(null);
    this.spokenTo = 0;
  }
}
