import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { NeatChatTranscript, type NeatChatMessage } from '@sima/neat-ui/chat';
import {
  NEAT_SPEAKING_MOTIONS,
  neatSpeakable,
  type NeatSpeakingMotion,
  type NeatSpeech,
} from '@sima/neat-ui/markdown';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';

/** The reply read aloud: the moments mockup's two sentences. */
const REPLY =
  'Three jars of dried pasta, a bottle of olive oil, canned tomatoes and a braid of garlic. ' +
  'Together that is most of a *pasta al pomodoro*.';
/** How long a sentence takes to say: 55 ms a character, the mockup's pace. */
const MS_PER_CHARACTER = 55;
/** The pretend voice: its sample rate, its pitch, and the strip's bars its loudness follows. */
const SAMPLE_RATE = 8000;
const PITCH = 220;
const BARS = 90;
/** The pause after the reply before it is read again. */
const PAUSE_MS = 600;

const NAMES: Record<NeatSpeakingMotion, string> = {
  sentence: 'Sentence',
  karaoke: 'Karaoke',
  'word-by-word': 'Word by word',
  waveform: 'Waveform',
};

/** A seeded random, so the pretend voice is the same each time (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A pretend voice for sentence `k` lasting `ms`: a tone whose loudness follows the mockup's waveform. */
function voice(k: number, ms: number): Float32Array {
  const random = seeded(k + 1);
  const shape = Array.from({ length: BARS }, (_, i) =>
    Math.max(0.05, Math.abs(Math.sin(i * 0.35) * Math.sin(i * 0.11 + k)) * (0.5 + random() * 0.5)),
  );
  const samples = new Float32Array(Math.round((ms / 1000) * SAMPLE_RATE));
  for (let j = 0; j < samples.length; j++) {
    const bar = Math.min(BARS - 1, Math.floor((j / samples.length) * BARS));
    samples[j] = shape[bar] * Math.sin((2 * Math.PI * PITCH * j) / SAMPLE_RATE);
  }
  return samples;
}

/**
 * A reply read aloud: its sentences come from `neatSpeakable`, and each is "spoken" in turn at the
 * pace of a voice, with a pretend voice's samples. The app gives the sentence being said to the
 * reply as its `speech`, and the transcript shows it in the `speakingMotion`: the sentence, karaoke,
 * word by word, or the waveform's strip under the reply. Pick one; the reply is read again after a
 * pause.
 *
 * @animated
 */
@Component({
  selector: 'app-read-aloud',
  imports: [NeatChatTranscript, NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './5-read-aloud.example.html',
  styleUrl: './read-aloud.example.css',
})
export class ReadAloud {
  protected readonly motions: readonly NeatSelectOption<NeatSpeakingMotion>[] =
    NEAT_SPEAKING_MOTIONS.map((motion) => ({ value: motion, label: NAMES[motion] }));
  protected readonly motion = signal<NeatSpeakingMotion | null>('waveform');
  private readonly speech = signal<NeatSpeech | null>(null);

  protected readonly messages = computed<NeatChatMessage[]>(() => {
    const speech = this.speech();
    return [
      { id: 'question', role: 'user', text: "What's on this shelf?" },
      { id: 'reply', role: 'assistant', text: REPLY, ...(speech ? { speech } : {}) },
    ];
  });

  constructor() {
    const sentences = neatSpeakable(REPLY);
    let timer: ReturnType<typeof setTimeout>;
    const say = (k: number) => {
      if (k === sentences.length) {
        this.speech.set(null);
        timer = setTimeout(() => say(0), PAUSE_MS);
        return;
      }
      const sentence = sentences[k];
      const ms = sentence.text.length * MS_PER_CHARACTER;
      this.speech.set({
        from: sentence.from,
        to: sentence.to,
        startedAt: performance.now(),
        audio: { samples: voice(k, ms), sampleRate: SAMPLE_RATE },
      });
      timer = setTimeout(() => say(k + 1), ms);
    };
    timer = setTimeout(() => say(0), 500);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
