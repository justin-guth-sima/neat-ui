import {
  type InsightConnectionEvents,
  type InsightConnectionOptions,
  openInsightConnection,
} from './insight-connection';
import {
  answer,
  bareResponse,
  errorResponse,
  FakePeer,
  stubWebRtc,
} from './insight-connection.testing';

/** A connection whose reports the spec reads back: the last of each, and the metadata seen. */
function open(options: Partial<InsightConnectionOptions> = {}) {
  const seen = {
    stream: null as unknown,
    waiting: null as string | null,
    failure: null as string | null,
    failures: 0,
    videoDelayMs: null as number | null,
    metadata: [] as string[],
  };
  const events: InsightConnectionEvents = {
    stream: (stream) => (seen.stream = stream),
    waiting: (text) => (seen.waiting = text),
    failure: (text) => {
      seen.failure = text;
      seen.failures += 1;
    },
    videoDelayMs: (ms) => (seen.videoDelayMs = ms),
    metadata: (text) => seen.metadata.push(text),
  };
  const close = openInsightConnection({ offerUrl: '/offer', ...options }, events);
  return { seen, close };
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
});
