import type { NeatEncodedFrame, NeatEncodedFrames } from '@sima/neat-ui/video';
import {
  type InsightConnectionEvents,
  type InsightConnectionOptions,
  type NeatInsightVideoStats,
  openInsightConnection,
} from './insight-connection';
import {
  answer,
  bareResponse,
  errorResponse,
  FakePeer,
  jpegChunk,
  stubWebRtc,
} from './insight-connection.testing';
import { JPEG_8X8_BASELINE } from './jpeg-fixture.testing';

/** A connection whose reports the spec reads back: the last of each, and the metadata seen. */
function open(options: Partial<InsightConnectionOptions> = {}) {
  const seen = {
    stream: null as unknown,
    waiting: null as string | null,
    failure: null as string | null,
    failures: 0,
    videoDelayMs: null as number | null,
    stats: null as NeatInsightVideoStats | null,
    metadata: [] as string[],
    frames: null as NeatEncodedFrames | null,
    runs: [] as (NeatEncodedFrames | null)[],
    /** `stream` and `frames` reports in order: "stream", "frames", or with " null". */
    order: [] as string[],
  };
  const events: InsightConnectionEvents = {
    stream: (stream) => {
      seen.stream = stream;
      seen.order.push(stream ? 'stream' : 'stream null');
    },
    waiting: (text) => (seen.waiting = text),
    failure: (text) => {
      seen.failure = text;
      seen.failures += 1;
    },
    videoDelayMs: (ms) => (seen.videoDelayMs = ms),
    stats: (stats) => (seen.stats = stats),
    metadata: (text) => seen.metadata.push(text),
    frames: (frames) => {
      seen.frames = frames;
      seen.runs.push(frames);
      seen.order.push(frames ? 'frames' : 'frames null');
    },
  };
  const connection = openInsightConnection({ offerUrl: '/offer', ...options }, events);
  return { seen, connection, close: () => connection.close() };
}

/** Sends a frame on `peer`'s jpeg channel in `count` chunks (the last one takes the rest). */
function sendFrame(
  peer: FakePeer,
  timestamp: number,
  bytes: Uint8Array = JPEG_8X8_BASELINE,
  count = 1,
) {
  const size = Math.ceil(bytes.byteLength / count);
  for (let index = 0; index < count; index++) {
    const part = bytes.subarray(index * size, (index + 1) * size);
    peer.jpeg.onmessage?.({ data: jpegChunk(timestamp, index, count, part) });
  }
}

/** The frames a run gives one listener. */
function framesOf(run: NeatEncodedFrames | null): NeatEncodedFrame[] {
  const frames: NeatEncodedFrame[] = [];
  if (!run) throw new Error('no run');
  run.onFrame((frame) => frames.push(frame));
  return frames;
}

/** The fixture with its SOF0 size changed, for a frame of another size. */
function sized(width: number, height: number): Uint8Array {
  const bytes = JPEG_8X8_BASELINE.slice();
  const at = bytes.findIndex((byte, i) => byte === 0xff && bytes[i + 1] === 0xc0);
  const view = new DataView(bytes.buffer);
  view.setUint16(at + 5, height);
  view.setUint16(at + 7, width);
  return bytes;
}

describe('openInsightConnection', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = stubWebRtc();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('posts the offer to the given address as it is, and applies the answer', async () => {
    const { close } = open({ offerUrl: '/api/offer?channel=3' });
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/offer?channel=3');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ type: 'offer', sdp: 'offer-sdp' });
    const peer = FakePeer.all[0];
    expect(peer.transceivers).toEqual([{ kind: 'video', init: { direction: 'recvonly' } }]);
    expect(peer.channels).toEqual([
      { label: 'metadata', init: { ordered: true, maxRetransmits: 0 } },
      { label: 'jpeg', init: { ordered: true, maxPacketLifeTime: 300 } },
    ]);
    expect(peer.remote).toEqual(answer);
    close();
  });

  it('reports the remote stream once a video track arrives', async () => {
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.stream).toBeNull();

    FakePeer.all[0].ontrack?.({ track: { kind: 'audio' }, streams: [{ id: 'audio' }] });
    expect(seen.stream).toBeNull();
    FakePeer.all[0].track('remote');
    expect(seen.stream).toEqual({ id: 'remote' });
    expect(seen.frames).toBeNull();
    expect(seen.runs.filter((run) => run !== null)).toEqual([]);
    close();
  });

  it('reports the data channel’s text messages as metadata', async () => {
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);

    FakePeer.all[0].channel.onmessage?.({ data: '{"a":1}' });
    FakePeer.all[0].channel.onmessage?.({ data: new ArrayBuffer(4) });
    expect(seen.metadata).toEqual(['{"a":1}']);
    close();
  });

  it('reconnects after 1, 2, 5, 10 s and stays at 10 s', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const { close } = open();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    let calls = 1;
    for (const wait of [1000, 2000, 5000, 10000, 10000]) {
      await vi.advanceTimersByTimeAsync(wait - 1);
      expect(fetchMock).toHaveBeenCalledTimes(calls);
      await vi.advanceTimersByTimeAsync(1);
      calls += 1;
      expect(fetchMock).toHaveBeenCalledTimes(calls);
    }
    close();
  });

  it('reconnects when the connection fails, drops the stream and restarts the back-off', async () => {
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    const first = FakePeer.all[0];
    first.setState('connected');
    first.track();
    expect(seen.stream).not.toBeNull();

    first.setState('failed');
    expect(seen.stream).toBeNull();
    expect(first.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakePeer.all).toHaveLength(2);
    close();
  });

  it('stops reconnecting once closed', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    close();
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakePeer.all[0].closed).toBe(true);
    expect(seen.stream).toBeNull();
    expect(seen.waiting).toBeNull();
  });

  it('keeps a healthy connection', async () => {
    const { close } = open();
    await vi.advanceTimersByTimeAsync(0);
    FakePeer.all[0].setState('connected');
    await vi.advanceTimersByTimeAsync(30000);
    expect(FakePeer.all).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    close();
  });

  it('rebuilds after 5 s without decoded frames', async () => {
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    const first = FakePeer.all[0];
    first.setState('connected');
    first.track();
    await vi.advanceTimersByTimeAsync(3000);
    first.autoFrames = false;
    await vi.advanceTimersByTimeAsync(3000);
    expect(FakePeer.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(first.closed).toBe(true);
    expect(seen.stream).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakePeer.all).toHaveLength(2);
    close();
  });

  it('rebuilds after 5 s disconnected', async () => {
    const { close } = open();
    await vi.advanceTimersByTimeAsync(0);
    const first = FakePeer.all[0];
    first.setState('disconnected');
    await vi.advanceTimersByTimeAsync(3000);
    expect(first.closed).toBe(false);
    first.setState('connected');
    await vi.advanceTimersByTimeAsync(1000);
    first.setState('disconnected');
    await vi.advanceTimersByTimeAsync(4000);
    expect(first.closed).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(first.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakePeer.all).toHaveLength(2);
    close();
  });

  it('stops on a 415 answer, says the codec is not supported, and leaves no timer', async () => {
    fetchMock.mockResolvedValue(errorResponse(415, 'codec_unsupported', 'H.265 is not offered'));
    const { seen, close } = open();
    expect(seen.failure).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.failure).toBe('Codec not supported by this browser');
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    close();
    expect(seen.failures).toBe(1);
  });

  it.each([
    [400, 'invalid_request', 'channel must be a number'],
    [400, 'no_such_channel', 'There is no such channel.'],
    [403, 'cross_origin', 'Insight refuses changes sent by another website.'],
    [413, 'offer_too_large', 'The offer is larger than 64 KiB.'],
  ])('stops on a %i %s answer with its message', async (status, code, message) => {
    fetchMock.mockResolvedValue(errorResponse(status, code, message));
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.failure).toBe(message);
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    close();
  });

  it('stops on a 4xx answer without a message with its status', async () => {
    fetchMock.mockResolvedValue(bareResponse(404));
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.failure).toBe('Connection failed: HTTP 404');
    close();
  });

  it.each([
    [503, 'no_video', 'Waiting for video'],
    [503, 'codec_changed', 'Video format changed'],
    [500, 'negotiation_failed', 'Could not connect'],
    [502, 'insight_unreachable', 'Insight not reachable'],
    [503, 'too_many_viewers', 'Too many viewers'],
  ])('retries a %i %s answer and says so until video comes', async (status, code, text) => {
    fetchMock.mockResolvedValueOnce(errorResponse(status, code, 'details'));
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.waiting).toBe(text);
    expect(seen.failure).toBeNull();

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    FakePeer.all[1].track();
    expect(seen.waiting).toBeNull();
    close();
  });

  it.each([
    ['no answer at all', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 502 without a code', async () => bareResponse(502)],
    ['a 504 without a code', async () => bareResponse(504)],
  ])('says Insight is not reachable after %s, and retries', async (_case, response) => {
    fetchMock.mockImplementationOnce(response);
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.waiting).toBe('Insight not reachable');
    expect(seen.failure).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    close();
  });

  it('says nothing while retrying an answer whose code or status says nothing it knows', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(500, 'internal', 'boom'))
      .mockResolvedValueOnce(errorResponse(503, 'constructor', 'not a key of the table'))
      .mockResolvedValueOnce(bareResponse(500));
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.waiting).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen.waiting).toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(seen.waiting).toBeNull();
    close();
  });

  it('retries an answer that is not an answer', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.failure).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakePeer.all[1].remote).toEqual(answer);
    close();
  });

  it('keeps retrying a 5xx answer without a failure', async () => {
    fetchMock.mockResolvedValue(bareResponse(503));
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(seen.failure).toBeNull();
    close();
  });

  it('restarts the back-off after a connection reached connected', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockRejectedValueOnce(new TypeError('offline'));
    const { close } = open();
    await vi.advanceTimersByTimeAsync(3000); // attempts 1, 2, 3 (after 1 s and 2 s)
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const third = FakePeer.all[2];
    third.setState('connected');
    third.setState('failed');
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    close();
  });

  it('ignores the late events of a replaced peer', async () => {
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    const first = FakePeer.all[0];
    first.setState('failed');
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakePeer.all).toHaveLength(2);

    first.track('old');
    first.channel.onmessage?.({ data: 'old' });
    first.setState('failed');
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.stream).toBeNull();
    expect(seen.metadata).toEqual([]);
    expect(FakePeer.all).toHaveLength(2);
    close();
  });

  it('changes the video buffer of the open connection and of the ones that replace it', async () => {
    const { connection, close } = open({ videoBufferMs: 100 });
    await vi.advanceTimersByTimeAsync(0);
    connection.setVideoBufferMs(250);
    expect(FakePeer.all[0].receiver.jitterBufferTarget).toBe(250);

    FakePeer.all[0].setState('failed');
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakePeer.all[1].receiver.jitterBufferTarget).toBe(250);
    close();
    connection.setVideoBufferMs(400); // closed: no receiver to change
    expect(FakePeer.all[1].receiver.jitterBufferTarget).toBe(250);
  });

  it('reports what arrives once a second while connected, null otherwise', async () => {
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    const peer = FakePeer.all[0];
    peer.stepBytes = 250_000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen.stats).toBeNull(); // still connecting

    peer.setState('connected');
    await vi.advanceTimersByTimeAsync(1000); // the first sample has no bitrate yet
    expect(seen.stats).toEqual({
      codec: 'H264',
      width: 1280,
      height: 720,
      framesPerSecond: 30,
      bitsPerSecond: 0,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen.stats?.bitsPerSecond).toBe(2_000_000);

    peer.video = {};
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen.stats).toEqual({
      codec: null,
      width: null,
      height: null,
      framesPerSecond: null,
      bitsPerSecond: 2_000_000,
    });

    peer.setState('failed');
    expect(seen.stats).toBeNull();
    close();
  });

  it('tells its log each step, and why it retries', async () => {
    const log = vi.fn();
    const { close } = open({ log });
    await vi.advanceTimersByTimeAsync(0);
    FakePeer.all[0].setState('failed');
    expect(log.mock.calls.map(([event]) => event)).toEqual([
      'connecting',
      'answered',
      'connection state',
      'retrying',
    ]);
    expect(log).toHaveBeenCalledWith('retrying', { reason: 'connection failed', inMs: 1000 });
    close();
    expect(log).toHaveBeenLastCalledWith('closed');
  });

  it('sets jitterBufferTarget to videoBufferMs and leaves it alone without one', async () => {
    const buffered = open({ videoBufferMs: 100 });
    await vi.advanceTimersByTimeAsync(0);
    expect(FakePeer.all[0].receiver.jitterBufferTarget).toBe(100);
    buffered.close();

    const plain = open();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakePeer.all[1].receiver.jitterBufferTarget).toBeNull();
    plain.close();
  });

  it('connects in a browser without jitterBufferTarget, or one that refuses the value', async () => {
    class NoTargetPeer extends FakePeer {
      override receiver = {};
    }
    vi.stubGlobal('RTCPeerConnection', NoTargetPeer);
    const absent = open({ videoBufferMs: 100 });
    await vi.advanceTimersByTimeAsync(0);
    expect(FakePeer.all[0].receiver).not.toHaveProperty('jitterBufferTarget');
    expect(FakePeer.all[0].remote).toEqual(answer);
    absent.close();

    class RefusingPeer extends FakePeer {
      override receiver = {
        get jitterBufferTarget(): number | null {
          return null;
        },
        set jitterBufferTarget(_ms: number | null) {
          throw new RangeError('out of range');
        },
      };
    }
    vi.stubGlobal('RTCPeerConnection', RefusingPeer);
    const refused = open({ videoBufferMs: 100_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(FakePeer.all[1].remote).toEqual(answer);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    refused.close();
  });

  it('reports the mean jitter buffer delay per emitted frame over the last second', async () => {
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    const peer = FakePeer.all[0];
    peer.setState('connected');
    peer.stepDelay = 2.4;
    peer.stepCount = 30;
    await vi.advanceTimersByTimeAsync(1000); // first sample: the baseline
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen.videoDelayMs).toBeCloseTo(80);

    peer.stepDelay = 0.6;
    peer.stepCount = 30;
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen.videoDelayMs).toBeCloseTo(20);

    peer.stepDelay = 0;
    peer.stepCount = 0;
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen.videoDelayMs).toBeNull();
    close();
  });

  it('reports no delay without a connected peer', async () => {
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    const peer = FakePeer.all[0];
    peer.stepDelay = 2.4;
    peer.stepCount = 30;
    await vi.advanceTimersByTimeAsync(3000);
    expect(seen.videoDelayMs).toBeNull(); // still connecting

    peer.setState('connected');
    await vi.advanceTimersByTimeAsync(2000);
    expect(seen.videoDelayMs).not.toBeNull();
    peer.setState('disconnected');
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen.videoDelayMs).toBeNull();
    close();
    expect(seen.videoDelayMs).toBeNull();
  });

  it('cancels a pending retry and the health timer when closed, and closes once', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const { seen, close } = open();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(2); // the retry and the health timer
    close();
    expect(vi.getTimerCount()).toBe(0);
    seen.stream = 'untouched';
    close();
    expect(seen.stream).toBe('untouched');
  });

  it('fails at once in a browser without WebRTC, posting nothing', async () => {
    vi.stubGlobal('RTCPeerConnection', undefined);
    const { seen, close } = open();
    expect(seen.failure).toBe('This browser has no WebRTC');
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    close();
  });

  describe('the jpeg channel', () => {
    it('opens the jpeg channel ordered with a 300 ms packet lifetime, as array buffers', async () => {
      const { close } = open();
      await vi.advanceTimersByTimeAsync(0);
      const first = FakePeer.all[0];
      expect(first.channels[1]).toEqual({
        label: 'jpeg',
        init: { ordered: true, maxPacketLifeTime: 300 },
      });
      expect(first.jpeg.binaryType).toBe('arraybuffer');

      first.setState('failed');
      await vi.advanceTimersByTimeAsync(1000);
      expect(FakePeer.all[1].channels.map(({ label }) => label)).toEqual(['metadata', 'jpeg']);
      expect(FakePeer.all[1].jpeg.binaryType).toBe('arraybuffer');
      close();
    });

    it('reports a run on the first chunk and clears waiting', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(503, 'no_video', 'details'));
      const { seen, close } = open();
      await vi.advanceTimersByTimeAsync(1000);
      expect(seen.waiting).toBe('Waiting for video');
      const peer = FakePeer.all[1];

      peer.jpeg.onmessage?.({ data: 'text' });
      peer.jpeg.onmessage?.({ data: new ArrayBuffer(8) }); // a header and no bytes: dropped
      expect(seen.frames).toBeNull();
      expect(seen.waiting).toBe('Waiting for video');

      const half = JPEG_8X8_BASELINE.subarray(0, 300);
      peer.jpeg.onmessage?.({ data: jpegChunk(7, 0, 2, half) });
      expect(seen.frames).not.toBeNull();
      expect(seen.waiting).toBeNull();
      sendFrame(peer, 8);
      expect(seen.runs.filter((run) => run !== null)).toHaveLength(1);
      close();
    });

    it('gives whole frames presentAt of arrival plus the buffer, and a new buffer applies to later frames only', async () => {
      const { seen, connection, close } = open({ videoBufferMs: 100 });
      await vi.advanceTimersByTimeAsync(0);
      const peer = FakePeer.all[0];
      peer.jpeg.onmessage?.({ data: jpegChunk(90, 0, 2, JPEG_8X8_BASELINE.subarray(0, 300)) });
      const frames = framesOf(seen.frames);
      await vi.advanceTimersByTimeAsync(10);
      peer.jpeg.onmessage?.({ data: jpegChunk(90, 1, 2, JPEG_8X8_BASELINE.subarray(300)) });
      const arrival = performance.now();
      expect(frames).toHaveLength(1);
      expect(frames[0].rtpTimestamp).toBe(90);
      expect(frames[0].presentAt).toBe(arrival + 100);
      expect(frames[0].data.type).toBe('image/jpeg');
      expect(new Uint8Array(await frames[0].data.arrayBuffer())).toEqual(JPEG_8X8_BASELINE);

      connection.setVideoBufferMs(250);
      expect(frames[0].presentAt).toBe(arrival + 100);
      await vi.advanceTimersByTimeAsync(33);
      sendFrame(peer, 91, JPEG_8X8_BASELINE, 3);
      expect(frames[1].presentAt).toBe(performance.now() + 250);

      connection.setVideoBufferMs(undefined);
      sendFrame(peer, 92);
      expect(frames[2].presentAt).toBe(performance.now());
      close();
    });

    it('withdraws a track that came with the answer once the first chunk arrives, and plays frames', async () => {
      const { seen, close } = open();
      await vi.advanceTimersByTimeAsync(0);
      const peer = FakePeer.all[0];
      peer.setState('connected');
      peer.track('sendonly');
      expect(seen.stream).toEqual({ id: 'sendonly' });

      seen.order = [];
      sendFrame(peer, 1);
      expect(seen.order).toEqual(['stream null', 'frames']);
      expect(seen.stream).toBeNull();
      expect(seen.frames).not.toBeNull();

      peer.inbound = false;
      peer.autoFrames = false; // the track decodes nothing, and frames need no decoder
      await vi.advanceTimersByTimeAsync(10000);
      expect(peer.closed).toBe(false);
      close();
    });

    it('reports no stream for a track that arrives after the first chunk', async () => {
      const { seen, close } = open();
      await vi.advanceTimersByTimeAsync(0);
      const peer = FakePeer.all[0];
      sendFrame(peer, 1);
      const run = seen.frames;
      seen.order = [];
      peer.track('late');
      expect(seen.stream).toBeNull();
      expect(seen.frames).toBe(run);
      expect(seen.order).toEqual([]);
      close();
    });

    it('reports frames null when the peer is dropped', async () => {
      const { seen, close } = open();
      await vi.advanceTimersByTimeAsync(0);
      sendFrame(FakePeer.all[0], 1);
      const first = seen.frames;
      FakePeer.all[0].setState('failed');
      expect(seen.frames).toBeNull();

      await vi.advanceTimersByTimeAsync(1000);
      sendFrame(FakePeer.all[1], 2);
      expect(seen.frames).not.toBeNull();
      expect(seen.frames).not.toBe(first); // a run per connection
      close();
      expect(seen.frames).toBeNull();
    });

    it('reports the stream with frames null on a later connection with a track', async () => {
      const { seen, close } = open();
      await vi.advanceTimersByTimeAsync(0);
      sendFrame(FakePeer.all[0], 1);
      FakePeer.all[0].setState('failed');
      await vi.advanceTimersByTimeAsync(1000);
      FakePeer.all[1].track('h264');
      expect(seen.stream).toEqual({ id: 'h264' });
      expect(seen.frames).toBeNull();
      close();
    });

    it('in frames mode rebuilds nothing after 10 s without frames or an inbound report, but still after 5 s disconnected', async () => {
      const { close } = open();
      await vi.advanceTimersByTimeAsync(0);
      const peer = FakePeer.all[0];
      peer.inbound = false;
      peer.setState('connected');
      sendFrame(peer, 1);
      await vi.advanceTimersByTimeAsync(10000);
      expect(peer.closed).toBe(false);
      expect(FakePeer.all).toHaveLength(1);

      peer.setState('disconnected');
      await vi.advanceTimersByTimeAsync(5000);
      expect(peer.closed).toBe(false);
      await vi.advanceTimersByTimeAsync(1000);
      expect(peer.closed).toBe(true);
      await vi.advanceTimersByTimeAsync(1000);
      expect(FakePeer.all).toHaveLength(2);
      close();
    });

    it('still rebuilds after 5 s without decoded frames before any chunk or track', async () => {
      const { close } = open();
      await vi.advanceTimersByTimeAsync(0);
      const peer = FakePeer.all[0];
      peer.inbound = false;
      peer.setState('connected');
      await vi.advanceTimersByTimeAsync(5000); // the first sample counts as progress
      expect(peer.closed).toBe(false);
      await vi.advanceTimersByTimeAsync(1000);
      expect(peer.closed).toBe(true);
      close();
    });

    it('retries when the jpeg channel closes, and not on a close of its own', async () => {
      const log = vi.fn();
      const { close } = open({ log });
      await vi.advanceTimersByTimeAsync(0);
      const first = FakePeer.all[0];
      first.jpeg.close();
      expect(first.closed).toBe(true);
      expect(log).toHaveBeenCalledWith('retrying', { reason: 'frames channel closed', inMs: 1000 });
      await vi.advanceTimersByTimeAsync(1000);
      expect(FakePeer.all).toHaveLength(2);

      close();
      FakePeer.all[1].jpeg.close();
      await vi.advanceTimersByTimeAsync(60000);
      expect(FakePeer.all).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(log.mock.calls.filter(([event]) => event === 'retrying')).toHaveLength(1);
    });

    it('retries nothing when the connection closes or replaces a peer, whose channels then close', async () => {
      const log = vi.fn();
      const { close } = open({ log });
      await vi.advanceTimersByTimeAsync(0);
      FakePeer.all[0].setState('failed'); // one retry: dropPeer closes the peer and its channels
      expect(log.mock.calls.filter(([event]) => event === 'retrying')).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(FakePeer.all).toHaveLength(2); // the replaced peer's close made no second retry
      close();
      await vi.advanceTimersByTimeAsync(60000);
      expect(FakePeer.all).toHaveLength(2);
      expect(log.mock.calls.filter(([event]) => event === 'retrying')).toHaveLength(1);
    });

    it('gives a frame to every listener even when one throws, and reports the error', async () => {
      const reported: unknown[] = [];
      vi.stubGlobal('reportError', (error: unknown) => reported.push(error));
      const { seen } = open();
      await vi.advanceTimersByTimeAsync(0);
      const peer = FakePeer.all[0];
      peer.setState('connected');
      sendFrame(peer, 0);
      const boom = new Error('boom');
      seen.frames?.onFrame(() => {
        throw boom;
      });
      const after = framesOf(seen.frames);
      sendFrame(peer, 1);
      expect(after).toHaveLength(1);
      expect(reported).toEqual([boom]);
    });

    it('reports JPEG, the SOF0 size, fps and bitrate from the chunk counters', async () => {
      const { seen, close } = open();
      await vi.advanceTimersByTimeAsync(0);
      const peer = FakePeer.all[0];
      peer.inbound = false;
      peer.setState('connected');
      sendFrame(peer, 0);
      await vi.advanceTimersByTimeAsync(1000); // the first sample has no rates yet
      expect(seen.stats).toEqual({
        codec: 'JPEG',
        width: 8,
        height: 8,
        framesPerSecond: null,
        bitsPerSecond: 0,
      });

      for (let timestamp = 1; timestamp < 30; timestamp++) sendFrame(peer, timestamp, undefined, 2);
      sendFrame(peer, 30, sized(1280, 720), 2);
      peer.jpeg.onmessage?.({ data: jpegChunk(31, 0, 2, JPEG_8X8_BASELINE.subarray(0, 100)) });
      await vi.advanceTimersByTimeAsync(1000);
      expect(seen.stats).toEqual({
        codec: 'JPEG',
        width: 1280,
        height: 720,
        framesPerSecond: 30,
        bitsPerSecond: (30 * JPEG_8X8_BASELINE.byteLength + 100) * 8,
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(seen.stats).toEqual({
        codec: 'JPEG',
        width: 1280,
        height: 720,
        framesPerSecond: 0,
        bitsPerSecond: 0,
      });

      peer.setState('disconnected');
      await vi.advanceTimersByTimeAsync(1000);
      expect(seen.stats).toBeNull();
      close();
    });

    it('reports the mean hold of the last second as videoDelayMs', async () => {
      const { seen, connection, close } = open({ videoBufferMs: 100 });
      await vi.advanceTimersByTimeAsync(0);
      const peer = FakePeer.all[0];
      peer.inbound = false;
      peer.setState('connected');
      for (let timestamp = 0; timestamp < 3; timestamp++) sendFrame(peer, timestamp);
      connection.setVideoBufferMs(200);
      sendFrame(peer, 3);
      await vi.advanceTimersByTimeAsync(1000);
      expect(seen.videoDelayMs).toBe(125);

      await vi.advanceTimersByTimeAsync(1000);
      expect(seen.videoDelayMs).toBeNull(); // no frames in that second

      sendFrame(peer, 4);
      peer.setState('disconnected');
      await vi.advanceTimersByTimeAsync(1000);
      expect(seen.videoDelayMs).toBeNull();
      close();
    });

    it('tells its log frames on the first chunk', async () => {
      const log = vi.fn();
      const { close } = open({ log });
      await vi.advanceTimersByTimeAsync(0);
      sendFrame(FakePeer.all[0], 1, undefined, 2);
      sendFrame(FakePeer.all[0], 2);
      expect(log.mock.calls.map(([event]) => event)).toEqual(['connecting', 'answered', 'frames']);
      close();
    });

    it('ignores the chunks and the jpeg close of a replaced peer', async () => {
      const log = vi.fn();
      const { seen, close } = open({ log });
      await vi.advanceTimersByTimeAsync(0);
      const first = FakePeer.all[0];
      first.jpeg.onmessage?.({ data: jpegChunk(1, 0, 2, JPEG_8X8_BASELINE.subarray(0, 300)) });
      const frames = framesOf(seen.frames);
      first.setState('failed');
      await vi.advanceTimersByTimeAsync(1000);
      expect(FakePeer.all).toHaveLength(2);

      first.jpeg.onmessage?.({ data: jpegChunk(1, 1, 2, JPEG_8X8_BASELINE.subarray(300)) });
      sendFrame(first, 2);
      first.jpeg.close();
      await vi.advanceTimersByTimeAsync(2000);
      expect(frames).toEqual([]);
      expect(seen.frames).toBeNull();
      expect(seen.runs).toHaveLength(2); // the run, then null when the first peer failed
      expect(FakePeer.all).toHaveLength(2);
      expect(FakePeer.all[1].closed).toBe(false);
      expect(log.mock.calls.filter(([event]) => event === 'retrying')).toHaveLength(1);
      close();
    });

    it('gives every listener of a run each frame, and one unsubscribing leaves the others', async () => {
      const { seen, close } = open();
      await vi.advanceTimersByTimeAsync(0);
      const peer = FakePeer.all[0];
      peer.jpeg.onmessage?.({ data: jpegChunk(1, 0, 2, JPEG_8X8_BASELINE.subarray(0, 300)) });
      const run = seen.frames;
      if (!run) throw new Error('no run');
      const grid: number[] = [];
      const preview: number[] = [];
      const stopGrid = run.onFrame((frame) => grid.push(frame.rtpTimestamp ?? -1));
      run.onFrame((frame) => preview.push(frame.rtpTimestamp ?? -1));
      peer.jpeg.onmessage?.({ data: jpegChunk(1, 1, 2, JPEG_8X8_BASELINE.subarray(300)) });
      sendFrame(peer, 2);
      expect(grid).toEqual([1, 2]);
      expect(preview).toEqual([1, 2]);

      stopGrid();
      sendFrame(peer, 3);
      expect(grid).toEqual([1, 2]);
      expect(preview).toEqual([1, 2, 3]);
      close();
    });
  });
});
