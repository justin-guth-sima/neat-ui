import { describe, expect, it } from 'vitest';
import { FakeMediaRecorder, fakeMicDeps, flush, micEvents, sine } from './media.testing';
import { MIC_TYPES, MIN_RECORDING_MS, MicRecorder } from './mic-recorder';

/** A recorder with faked deps, its events and helpers. */
function setup(maxMs = 30_000, overrides: Parameters<typeof fakeMicDeps>[0] = {}) {
  const fake = fakeMicDeps(overrides);
  const events = micEvents();
  const mic = new MicRecorder(fake.deps, events.events, { maxMs });
  return { ...fake, ...events, mic };
}

/** Starts a recording and grants the microphone. */
async function recording(maxMs?: number) {
  const s = setup(maxMs);
  s.mic.start();
  const stream = s.mediaDevices.grant();
  await flush();
  return { ...s, stream };
}

describe('MicRecorder', () => {
  it('makes the audio context before it asks for the microphone', () => {
    const s = setup();
    s.mic.start();
    expect(s.context()).toBeDefined();
    expect(s.context()!.resumes).toBe(1);
    expect(s.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(s.mic.state).toBe('asking');
  });

  it('records with the first supported type and emits one blob with its length', async () => {
    const s = await recording();
    expect(s.mic.state).toBe('recording');
    expect(s.log).toEqual(['started']);
    expect(s.recorder()!.options?.mimeType).toBe('audio/webm;codecs=opus');
    expect(s.recorder()!.state).toBe('recording');
    expect(s.context()!.sources[0].connected).toBe(true);
    s.advance(2400);
    s.mic.stop();
    await flush();
    expect(s.log).toEqual(['started', 'recorded']);
    expect(s.recordings[0].durationMs).toBe(2400);
    expect(s.recordings[0].blob.type).toBe('audio/webm;codecs=opus');
    expect(await s.recordings[0].blob.text()).toBe('voice');
    expect(s.mic.state).toBe('idle');
  });

  it("takes a later type when the first is not supported, else the browser's own", async () => {
    const s = setup();
    FakeMediaRecorder.supported = new Set(['audio/mp4']);
    s.mic.start();
    s.mediaDevices.grant();
    await flush();
    expect(s.recorder()!.options?.mimeType).toBe('audio/mp4');
    s.mic.cancel();
    FakeMediaRecorder.supported = new Set();
    s.mic.start();
    s.mediaDevices.grant();
    await flush();
    expect(s.recorder()!.options).toBeUndefined();
    expect(MIC_TYPES[0]).toBe('audio/webm;codecs=opus');
  });

  it('a stop while asking records nothing and stops the tracks when they come', async () => {
    const s = setup();
    s.mic.start();
    s.mic.stop();
    expect(s.log).toEqual(['ended:canceled']);
    expect(s.mic.state).toBe('idle');
    expect(s.context()!.state).toBe('closed');
    const stream = s.mediaDevices.grant();
    await flush();
    expect(stream.stopped()).toBe(true);
    expect(s.recorder()).toBeUndefined();
    expect(s.log).toEqual(['ended:canceled']);
    expect(s.mic.state).toBe('idle');
  });

  it('a refusal that comes after a stop while asking says nothing more', async () => {
    const s = setup();
    s.mic.start();
    s.mic.stop();
    s.mediaDevices.refuse('NotAllowedError');
    await flush();
    expect(s.log).toEqual(['ended:canceled']);
  });

  it(`a recording under ${MIN_RECORDING_MS} ms ends as short`, async () => {
    const s = await recording();
    s.advance(MIN_RECORDING_MS - 1);
    s.mic.stop();
    await flush();
    expect(s.log).toEqual(['started', 'ended:short']);
    expect(s.recordings).toEqual([]);
    expect(s.stream.stopped()).toBe(true);
  });

  it('stops by itself at maxMs', async () => {
    const s = await recording(3000);
    s.advance(2999);
    expect(s.mic.state).toBe('recording');
    s.advance(1);
    await flush();
    expect(s.log).toEqual(['started', 'recorded']);
    expect(s.recordings[0].durationMs).toBe(3000);
  });

  it('a track that ends cancels the recording as missing', async () => {
    const s = await recording();
    s.advance(1000);
    s.stream.tracks[0].end();
    await flush();
    expect(s.log).toEqual(['started', 'ended:missing']);
    expect(s.recordings).toEqual([]);
    expect(s.stream.stopped()).toBe(true);
    expect(s.context()!.state).toBe('closed');
    expect(s.mic.state).toBe('idle');
  });

  it('every end stops the tracks and closes the context', async () => {
    // cancel
    let s = await recording();
    s.mic.cancel();
    await flush();
    expect(s.log).toEqual(['started', 'ended:canceled']);
    expect(s.stream.stopped()).toBe(true);
    expect(s.context()!.state).toBe('closed');
    expect(s.timers.size).toBe(0);
    // destroy
    s = await recording();
    s.mic.destroy();
    await flush();
    expect(s.log).toEqual(['started']);
    expect(s.recordings).toEqual([]);
    expect(s.stream.stopped()).toBe(true);
    expect(s.context()!.state).toBe('closed');
    expect(s.timers.size).toBe(0);
    // a recording
    s = await recording();
    s.advance(1000);
    s.mic.stop();
    await flush();
    expect(s.stream.stopped()).toBe(true);
    expect(s.context()!.state).toBe('closed');
    // an error
    const refused = setup();
    refused.mic.start();
    refused.mediaDevices.refuse('NotReadableError');
    await flush();
    expect(refused.log).toEqual(['ended:busy']);
    expect(refused.context()!.state).toBe('closed');
  });

  it('destroy while asking stops the tracks when they come', async () => {
    const s = setup();
    s.mic.start();
    s.mic.destroy();
    const stream = s.mediaDevices.grant();
    await flush();
    expect(stream.stopped()).toBe(true);
    expect(s.log).toEqual([]);
    expect(s.context()!.state).toBe('closed');
  });

  it('says insecure without a secure context and unsupported without MediaRecorder', () => {
    let s = setup(30_000, { isSecureContext: false });
    s.mic.start();
    expect(s.log).toEqual(['ended:insecure']);
    expect(s.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(s.mic.state).toBe('idle');
    s = setup(30_000, { MediaRecorder: undefined });
    s.mic.start();
    expect(s.log).toEqual(['ended:unsupported']);
    s = setup(30_000, { mediaDevices: undefined });
    s.mic.start();
    expect(s.log).toEqual(['ended:unsupported']);
    expect(s.context()).toBeUndefined();
  });

  it('maps a refused getUserMedia to blocked', async () => {
    const s = setup();
    s.mic.start();
    s.mediaDevices.refuse('NotAllowedError');
    await flush();
    expect(s.log).toEqual(['ended:blocked']);
    expect(s.mic.state).toBe('idle');
  });

  it('level is the RMS over the window from -50 to 0 dBFS, null when not recording', async () => {
    const s = setup();
    expect(s.mic.level()).toBeNull();
    expect(s.mic.levelDbfs()).toBeNull();
    s.mic.start();
    expect(s.mic.level()).toBeNull();
    s.mediaDevices.grant();
    await flush();
    s.context()!.analyzer.script = sine(1);
    expect(s.mic.level()).toBeCloseTo(0.94, 2);
    expect(s.mic.levelDbfs()).toBeCloseTo(-3.01, 1);
    s.context()!.analyzer.script = sine(0.1);
    expect(s.mic.level()).toBeCloseTo(0.54, 2);
    s.context()!.analyzer.script = (samples) => samples.fill(0);
    expect(s.mic.level()).toBe(0);
    expect(s.mic.levelDbfs()).toBeLessThanOrEqual(-50);
    expect(Number.isFinite(s.mic.levelDbfs())).toBe(true);
    s.mic.cancel();
    expect(s.mic.level()).toBeNull();
  });

  it('reads the level into one array per recording', async () => {
    const s = await recording();
    const seen = new Set<Float32Array>();
    s.context()!.analyzer.script = (samples) => {
      seen.add(samples);
      samples.fill(0.5);
    };
    for (let i = 0; i < 10; i++) s.mic.level();
    expect(seen.size).toBe(1);
    expect([...seen][0].length).toBe(2048);
  });

  it('start does nothing unless idle', async () => {
    const s = setup();
    s.mic.start();
    s.mic.start();
    expect(s.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    s.mediaDevices.grant();
    await flush();
    s.mic.start();
    expect(s.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    s.advance(1000);
    s.mic.stop();
    expect(s.mic.state).toBe('stopping');
    s.mic.start();
    expect(s.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    await flush();
    expect(s.log).toEqual(['started', 'recorded']);
  });
});
