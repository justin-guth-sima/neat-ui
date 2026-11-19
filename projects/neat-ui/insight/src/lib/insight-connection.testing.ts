// Fakes of the browser's WebRTC and fetch for the specs of the insight entry: no real connection
// is made in a test. Not part of the package.

class FakeDataChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
}

/** A peer connection that records what it is asked and lets the spec drive its events. */
export class FakePeer {
  static all: FakePeer[] = [];
  connectionState = 'new';
  onconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: { track: unknown; streams: unknown[] }) => void) | null = null;
  channel = new FakeDataChannel();
  transceivers: { kind: string; init: unknown }[] = [];
  channels: { label: string; init: unknown }[] = [];
  closed = false;
  remote: unknown = null;
  frames = 0;
  autoFrames = true;
  receiver: { jitterBufferTarget?: number | null } = { jitterBufferTarget: null };
  jitterDelay = 0;
  jitterCount = 0;
  /** Added to the jitter buffer counters on every stats call. */
  stepDelay = 0;
  stepCount = 0;

  constructor() {
    FakePeer.all.push(this);
  }
  addTransceiver(kind: string, init: unknown) {
    this.transceivers.push({ kind, init });
    return { receiver: this.receiver };
  }
  createDataChannel(label: string, init: unknown) {
    this.channels.push({ label, init });
    return this.channel;
  }
  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' };
  }
  async setLocalDescription() {
    return;
  }
  async setRemoteDescription(answer: unknown) {
    this.remote = answer;
  }
  async getStats() {
    if (this.autoFrames) this.frames += 1;
    this.jitterDelay += this.stepDelay;
    this.jitterCount += this.stepCount;
    return new Map([
      [
        'v',
        {
          type: 'inbound-rtp',
          kind: 'video',
          framesDecoded: this.frames,
          jitterBufferDelay: this.jitterDelay,
          jitterBufferEmittedCount: this.jitterCount,
        },
      ],
    ]);
  }
  close() {
    this.closed = true;
  }
  setState(state: string) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
  track(id = 's') {
    this.ontrack?.({ track: { kind: 'video' }, streams: [{ id }] });
  }
}

export const answer = { type: 'answer', sdp: 'answer-sdp' };

export function okResponse() {
  return { ok: true, status: 200, json: async () => answer };
}

/** An error answer in Insight's shape, as Insight and the relays give it. */
export function errorResponse(status: number, code: string, message: string) {
  return { ok: false, status, json: async () => ({ error: { code, message } }) };
}

/** An error answer without Insight's body, as a proxy or a server without the route gives it. */
export function bareResponse(status: number) {
  return { ok: false, status, json: async () => ({}) };
}

/**
 * Puts `FakePeer` and a `fetch` that answers with `answer` in place of the browser's; returns the
 * fetch mock. Call it in `beforeEach`, with fake timers, and `vi.unstubAllGlobals()` after.
 */
export function stubWebRtc(): ReturnType<typeof vi.fn> {
  FakePeer.all = [];
  const fetchMock = vi.fn(async () => okResponse());
  vi.stubGlobal('RTCPeerConnection', FakePeer);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
