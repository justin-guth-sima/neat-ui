// Fakes of the browser's WebRTC and fetch for the specs of the insight entry: no real connection
// is made in a test. Not part of the package.

import { JPEG_CHUNK_HEADER_BYTES } from './jpeg-chunks';

/** A data channel the spec drives: its messages by `onmessage`, its closing by `close()`. */
export class FakeDataChannel {
  binaryType = 'blob';
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  close() {
    this.onclose?.();
  }
}

/** A peer connection that records what it is asked and lets the spec drive its events. */
export class FakePeer {
  static all: FakePeer[] = [];
  connectionState = 'new';
  onconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: { track: unknown; streams: unknown[] }) => void) | null = null;
  /** The data channels the connection opened, one per label. */
  channelsByLabel = new Map<string, FakeDataChannel>();
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
  /** What arrives: bytes added on every stats call, each a second after the one before. */
  bytes = 0;
  stepBytes = 0;
  statsAt = 0;
  /** Whether the stats have an inbound video report; a JPEG connection has none. */
  inbound = true;
  video: { mimeType?: string; width?: number; height?: number; fps?: number } = {
    mimeType: 'video/H264',
    width: 1280,
    height: 720,
    fps: 30,
  };

  constructor() {
    FakePeer.all.push(this);
  }
  addTransceiver(kind: string, init: unknown) {
    this.transceivers.push({ kind, init });
    return { receiver: this.receiver };
  }
  /** The `metadata` channel, which most specs drive. */
  get channel(): FakeDataChannel {
    const metadata = this.channelsByLabel.get('metadata');
    if (!metadata) throw new Error('no metadata channel was opened');
    return metadata;
  }
  /** The `jpeg` channel, which carries a JPEG channel's frames. */
  get jpeg(): FakeDataChannel {
    const jpeg = this.channelsByLabel.get('jpeg');
    if (!jpeg) throw new Error('no jpeg channel was opened');
    return jpeg;
  }
  createDataChannel(label: string, init: unknown) {
    this.channels.push({ label, init });
    const channel = new FakeDataChannel();
    this.channelsByLabel.set(label, channel);
    return channel;
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
    this.bytes += this.stepBytes;
    this.statsAt += 1000;
    const { mimeType, width, height, fps } = this.video;
    const reports = new Map<string, Record<string, unknown>>([['c', { type: 'codec', mimeType }]]);
    if (this.inbound) {
      reports.set('v', {
        type: 'inbound-rtp',
        kind: 'video',
        timestamp: this.statsAt,
        framesDecoded: this.frames,
        jitterBufferDelay: this.jitterDelay,
        jitterBufferEmittedCount: this.jitterCount,
        bytesReceived: this.bytes,
        frameWidth: width,
        frameHeight: height,
        framesPerSecond: fps,
        codecId: 'c',
      });
    }
    return reports;
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

/**
 * One message of the `jpeg` data channel: the 8-byte header (timestamp, index and count,
 * big-endian) and then `bytes`.
 */
export function jpegChunk(
  timestamp: number,
  index: number,
  count: number,
  bytes: Uint8Array,
): ArrayBuffer {
  const data = new ArrayBuffer(JPEG_CHUNK_HEADER_BYTES + bytes.byteLength);
  const view = new DataView(data);
  view.setUint32(0, timestamp);
  view.setUint16(4, index);
  view.setUint16(6, count);
  new Uint8Array(data, JPEG_CHUNK_HEADER_BYTES).set(bytes);
  return data;
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
