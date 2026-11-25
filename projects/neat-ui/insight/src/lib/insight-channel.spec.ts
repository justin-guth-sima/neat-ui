import { createEnvironmentInjector, EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { neatInsightChannel, type NeatInsightChannelOptions } from './insight-channel';
import { errorResponse, FakePeer, jpegChunk, stubWebRtc } from './insight-connection.testing';
import { JPEG_8X8_BASELINE } from './jpeg-fixture.testing';

describe('neatInsightChannel', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let injector: EnvironmentInjector;

  /** A channel made in an injector the spec can destroy, its first post answered. */
  async function open(channel = 0, options?: NeatInsightChannelOptions) {
    const source = injector.runInContext(() => neatInsightChannel(channel, options));
    await vi.advanceTimersByTimeAsync(0);
    return source;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = stubWebRtc();
    injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  });

  afterEach(() => {
    if (!injector.destroyed) injector.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('posts the offer to Insight’s own route for the channel by default', async () => {
    await open(2);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/channels/2/offer');
  });

  it('posts to an offer address given as a string as it is', async () => {
    await open(2, { offer: '/relay/offer' });
    expect(fetchMock.mock.calls[0][0]).toBe('/relay/offer');
  });

  it('gives an offer function the channel', async () => {
    const offer = vi.fn((channel: number) => `/api/offer?channel=${channel}`);
    await open(5, { offer });
    expect(offer).toHaveBeenCalledWith(5);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/offer?channel=5');
  });

  it('sets the receiver’s jitterBufferTarget from videoBufferMs', async () => {
    await open(0, { videoBufferMs: 120 });
    expect(FakePeer.all[0].receiver.jitterBufferTarget).toBe(120);
  });

  it('follows a videoBufferMs signal while the channel is open', async () => {
    const bufferMs = signal(120);
    await open(0, { videoBufferMs: bufferMs });
    expect(FakePeer.all[0].receiver.jitterBufferTarget).toBe(120);

    bufferMs.set(300);
    TestBed.tick();
    expect(FakePeer.all[0].receiver.jitterBufferTarget).toBe(300);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the same connection, not a new one
  });

  it('says as a signal whether the video can be held: the browser’s jitterBufferTarget, or frames', async () => {
    vi.stubGlobal('RTCRtpReceiver', class {});
    const without = await open();
    expect(without.videoBufferSupported()).toBe(false);
    FakePeer.all[0].setState('connected');
    FakePeer.all[0].jpeg.onmessage?.({ data: jpegChunk(0, 0, 1, JPEG_8X8_BASELINE) });
    expect(without.videoBufferSupported()).toBe(true);
    FakePeer.all[0].setState('failed');
    expect(without.videoBufferSupported()).toBe(false);

    vi.stubGlobal(
      'RTCRtpReceiver',
      // A getter, as the browser's: on the prototype, where the channel looks for it.
      class {
        private readonly target: number | null = null;
        get jitterBufferTarget(): number | null {
          return this.target;
        }
      },
    );
    expect((await open()).videoBufferSupported()).toBe(true);
  });

  it('gives frames as a signal that follows the connection', async () => {
    const source = await open();
    expect(source.frames()).toBeNull();
    const peer = FakePeer.all[0];
    peer.setState('connected');
    peer.jpeg.onmessage?.({ data: jpegChunk(0, 0, 1, JPEG_8X8_BASELINE) });
    const run = source.frames();
    expect(run).not.toBeNull();
    const seen: unknown[] = [];
    run?.onFrame((frame) => seen.push(frame));
    peer.jpeg.onmessage?.({ data: jpegChunk(1, 0, 1, JPEG_8X8_BASELINE) });
    expect(seen).toHaveLength(1);

    peer.setState('failed');
    expect(source.frames()).toBeNull();
  });

  it('gives what arrives once connected', async () => {
    const source = await open();
    expect(source.stats()).toBeNull();
    FakePeer.all[0].setState('connected');
    await vi.advanceTimersByTimeAsync(1000);
    expect(source.stats()).toEqual({
      codec: 'H264',
      width: 1280,
      height: 720,
      framesPerSecond: 30,
      bitsPerSecond: 0,
    });
  });

  it('hands each step of the connection to its log', async () => {
    const log = vi.fn();
    await open(0, { log });
    expect(log).toHaveBeenCalledWith('connecting', {
      offerUrl: '/api/channels/0/offer',
      videoBufferMs: undefined,
    });
    expect(log).toHaveBeenCalledWith('answered');
  });

  it('gives the stream once a video track arrives, with no notice', async () => {
    const source = await open();
    expect(source.stream()).toBeNull();
    expect(source.notice()).toBeNull();

    FakePeer.all[0].track('remote');
    expect(source.stream()).toEqual({ id: 'remote' });
    expect(source.notice()).toBeNull();
  });

  it('says why it waits in notice while it retries, and nothing once video comes', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(503, 'no_video', 'No video yet.'));
    const source = await open();
    expect(source.notice()).toBe('Waiting for video');
    expect(source.failure()).toBeNull();

    await vi.advanceTimersByTimeAsync(1000);
    FakePeer.all[1].track();
    expect(source.notice()).toBeNull();
  });

  it('gives a final refusal as failure and as notice', async () => {
    fetchMock.mockResolvedValue(errorResponse(415, 'codec_unsupported', 'Not this codec.'));
    const source = await open();
    expect(source.failure()).toBe('Codec not supported by this browser');
    expect(source.notice()).toBe('Codec not supported by this browser');
  });

  it('measures the video delay once connected', async () => {
    const source = await open();
    expect(source.videoDelayMs()).toBeNull();
    const peer = FakePeer.all[0];
    peer.setState('connected');
    peer.stepDelay = 1.5;
    peer.stepCount = 30;
    await vi.advanceTimersByTimeAsync(2000);
    expect(source.videoDelayMs()).toBeCloseTo(50);
  });

  it('hands the metadata channel’s text to each listener until it unsubscribes', async () => {
    const source = await open();
    const first: [string, number][] = [];
    const second: string[] = [];
    const stopFirst = source.onMetadata((text, receivedAt) => first.push([text, receivedAt]));
    source.onMetadata((text) => second.push(text));

    FakePeer.all[0].channel.onmessage?.({ data: 'a' });
    stopFirst();
    FakePeer.all[0].channel.onmessage?.({ data: 'b' });

    expect(first).toEqual([['a', performance.now()]]);
    expect(second).toEqual(['a', 'b']);
  });

  it('closes the connection when its injector is destroyed', async () => {
    const source = await open();
    FakePeer.all[0].track();

    injector.destroy();
    expect(FakePeer.all[0].closed).toBe(true);
    expect(source.stream()).toBeNull();
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakePeer.all).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(() => source.close()).not.toThrow();
  });

  it('closes early on close(), and its injector’s end later does nothing more', async () => {
    const source = await open();
    source.close();
    expect(FakePeer.all[0].closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    source.close();
    injector.destroy();
    expect(FakePeer.all).toHaveLength(1);
  });

  it('cannot be made outside an injection context', () => {
    expect(() => neatInsightChannel(0)).toThrow(/NG0203/);
    expect(FakePeer.all).toHaveLength(0);
  });
});
