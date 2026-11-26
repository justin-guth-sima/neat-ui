import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  fakeMediaFlags,
  fakeVoiceWav,
  TONE_RMS,
  voiceLevels,
  writeFakeVoice,
} from './fake-voice.mjs';

/** The 16-bit samples of a WAV written by fakeVoiceWav, as numbers from -1 to 1. */
function samplesOf(wav) {
  const samples = [];
  for (let i = 44; i + 1 < wav.length; i += 2) samples.push(wav.readInt16LE(i) / 32768);
  return samples;
}

describe('fakeVoiceWav', () => {
  it('writes a RIFF WAV of 16-bit mono at 48 kHz of the asked length', () => {
    const wav = fakeVoiceWav(2.5, 3);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt32LE(4), wav.length - 8);
    assert.equal(wav.toString('ascii', 8, 16), 'WAVEfmt ');
    assert.equal(wav.readUInt16LE(20), 1); // PCM
    assert.equal(wav.readUInt16LE(22), 1); // mono
    assert.equal(wav.readUInt32LE(24), 48_000);
    assert.equal(wav.readUInt32LE(28), 96_000); // bytes a second
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.toString('ascii', 36, 40), 'data');
    assert.equal(wav.readUInt32LE(40), 2.5 * 48_000 * 2);
    assert.equal(wav.length, 44 + 2.5 * 48_000 * 2);
  });

  it('its loudness follows level(t)', () => {
    const seconds = 4;
    const samples = samplesOf(fakeVoiceWav(seconds, 1));
    const levels = voiceLevels(seconds, 1);
    const window = 48_000 * 0.05;
    assert.equal(levels.length, seconds * 20);
    for (let w = 0; w < levels.length; w++) {
      // level(t) = max(0.05, |sin(7t) sin(2.3t)| (0.6 + 0.4 r)), r seeded, one per window.
      const t = w * 0.05;
      const shape = Math.abs(Math.sin(7 * t) * Math.sin(2.3 * t));
      assert.ok(
        levels[w] >= Math.max(0.05, shape * 0.6) - 1e-6 &&
          levels[w] <= Math.max(0.05, shape) + 1e-6,
      );
      // Past the 4 ms in which a window's loudness moves from the last one's.
      let sum = 0;
      const from = w * window + 48_000 * 0.004;
      for (let i = from; i < (w + 1) * window; i++) sum += samples[i] ** 2;
      const rms = Math.sqrt(sum / ((w + 1) * window - from)) / TONE_RMS;
      assert.ok(
        Math.abs(rms - levels[w]) <= levels[w] * 0.1,
        `window ${w}: ${rms} for ${levels[w]}`,
      );
    }
  });

  it('the same seed gives the same bytes', () => {
    assert.deepEqual(fakeVoiceWav(1, 7), fakeVoiceWav(1, 7));
    assert.notDeepEqual(fakeVoiceWav(1, 7), fakeVoiceWav(1, 8));
  });

  it('writeFakeVoice writes it into a fresh temp folder', async () => {
    const path = await writeFakeVoice(1);
    assert.match(path, /fake-voice-[^/]+\/voice\.wav$/);
    assert.deepEqual(await readFile(path), fakeVoiceWav(1));
  });

  it("gives Chrome's fake media flags for a voice file", () => {
    assert.deepEqual(fakeMediaFlags('/tmp/x/voice.wav'), [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=/tmp/x/voice.wav',
    ]);
  });
});
