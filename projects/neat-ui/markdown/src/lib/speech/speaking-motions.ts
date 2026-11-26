/**
 * How a reply being read aloud shows how far the voice got, on the sentence being said:
 *
 * - `sentence`, the default and the still form: the sentence on a soft tint, the reply after it
 *   muted;
 * - `equalizer`: the sentence as `sentence`, and an equalizer beating beside its first line while
 *   it is said;
 * - `waveform`: the sentence as `sentence`, and in the transcript a strip of the sentence's audio
 *   with a playhead.
 *
 * Under reduced motion every motion is `sentence`.
 */
export type NeatSpeakingMotion = 'sentence' | 'equalizer' | 'waveform';

/** Every speaking motion, the still form first, for a picker. */
export const NEAT_SPEAKING_MOTIONS: readonly NeatSpeakingMotion[] = [
  'sentence',
  'equalizer',
  'waveform',
];

/** The audio of a sentence as samples, one channel. */
export interface NeatSpeechSamples {
  readonly samples: Float32Array;
  readonly sampleRate: number;
}

/** The sentence of a reply being said now, as read aloud plays it. */
export interface NeatSpeech {
  /** The sentence being played: its range in the text, as `neatSpeakable` gave it. */
  readonly from: number;
  readonly to: number;
  /** When it began to play, on the `performance.now()` clock. */
  readonly startedAt: number;
  /** What plays, one channel: how long the sentence lasts, and the transcript's waveform. */
  readonly audio: AudioBuffer | NeatSpeechSamples;
}

/** How long a speech's audio plays, in ms. Internal. */
export function speechDurationMs(audio: NeatSpeech['audio']): number {
  if ('getChannelData' in audio) return audio.duration * 1000;
  return audio.sampleRate > 0 ? (audio.samples.length / audio.sampleRate) * 1000 : 0;
}
