/*
 * A fake voice for Chrome's fake microphone: a WAV whose loudness moves as the moments mockup's
 * listening level does, so push-to-talk can be recorded in the docs' pictures, the bench and the
 * comparisons with the mockup without a person speaking. Chrome plays it as the microphone with
 * `--use-file-for-fake-audio-capture` (`fakeMediaFlags`).
 */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RATE = 48_000;
/** The window a level holds for (s): the mockup samples its level every 50 ms. */
const WINDOW = 0.05;
/** The tone: 180 Hz with two overtones at half and a quarter of its loudness. */
const PARTIALS = [
  [180, 1],
  [360, 0.5],
  [540, 0.25],
];
/** The tone's peak, so the sum stays inside full scale, and its RMS at a level of 1. */
const PEAK = PARTIALS.reduce((sum, [, gain]) => sum + gain, 0);
export const TONE_RMS =
  Math.sqrt(PARTIALS.reduce((sum, [, gain]) => sum + gain ** 2, 0) / 2) / PEAK;
/** How long a window's loudness takes to move to the next (s), so the tone does not click. */
const RAMP = 0.004;

/** A random that gives the same numbers for the same seed (mulberry32). */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The mockup's level for each 50 ms window: max(0.05, |sin(7t) sin(2.3t)| (0.6 + 0.4 r)). */
export function voiceLevels(seconds = 4, seed = 1) {
  const random = mulberry32(seed);
  const levels = new Float32Array(Math.round(seconds / WINDOW));
  for (let w = 0; w < levels.length; w++) {
    const t = w * WINDOW;
    levels[w] = Math.max(
      0.05,
      Math.abs(Math.sin(t * 7) * Math.sin(t * 2.3)) * (0.6 + random() * 0.4),
    );
  }
  return levels;
}

/** A WAV (16-bit PCM, 48 kHz, mono) of `seconds` of a 180 Hz tone with two overtones, its loudness the mockup's level(t), seeded. */
export function fakeVoiceWav(seconds = 4, seed = 1) {
  const levels = voiceLevels(seconds, seed);
  const count = Math.round(seconds * RATE);
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(RATE, 24);
  wav.writeUInt32LE(RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(count * 2, 40);
  const perWindow = WINDOW * RATE;
  for (let i = 0; i < count; i++) {
    const t = i / RATE;
    const w = Math.min(levels.length - 1, Math.floor(i / perWindow));
    // Each window starts at the last one's loudness and reaches its own within 4 ms.
    const into = (i - w * perWindow) / RATE;
    const before = w > 0 ? levels[w - 1] : levels[w];
    const level = into < RAMP ? before + (levels[w] - before) * (into / RAMP) : levels[w];
    let value = 0;
    for (const [frequency, gain] of PARTIALS) value += gain * Math.sin(2 * Math.PI * frequency * t);
    wav.writeInt16LE(Math.round((value / PEAK) * level * 32767), 44 + i * 2);
  }
  return wav;
}

/** Writes it into a fresh temp dir and returns its path. */
export async function writeFakeVoice(seconds = 4) {
  const folder = await mkdtemp(join(tmpdir(), 'fake-voice-'));
  const path = join(folder, 'voice.wav');
  await writeFile(path, fakeVoiceWav(seconds));
  return path;
}

/** Chrome's flags for a fake camera (its test pattern) and a microphone that plays `wav`. */
export function fakeMediaFlags(wav) {
  return [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}`,
  ];
}
