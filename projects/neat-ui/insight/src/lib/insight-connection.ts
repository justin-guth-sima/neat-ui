/**
 * One Insight channel's WebRTC connection, kept up until it is closed: the raw browser part of
 * `neatInsightChannel`. Internal. It touches no Angular state, so the caller runs it outside
 * Angular and turns what it reports into signals.
 *
 * As Insight's viewer does it, the offer is posted without waiting for ICE gathering: a recvonly
 * video transceiver plus the `metadata` data channel (ordered, no retransmits), then the answer is
 * applied. A failed post, or a connection that fails or closes, starts a new attempt after 1, 2, 5,
 * then every 10 seconds; a connection that comes up restarts that sequence. A connection whose
 * decoder makes no progress for 5 s, or that stays "disconnected" that long, is rebuilt, since after
 * a source restart the decoder can wait for a keyframe forever. A 4xx answer is final (415: this
 * browser cannot decode the codec), as is a browser without WebRTC: no retry, `failure` says why.
 *
 * Once a second, while connected, the inbound video's stats are sampled: the decoder's progress for
 * the stall check, the jitter buffer's delay, and what arrives (codec, frame size, rate, bitrate).
 */

/** Milliseconds to wait before reconnect attempt 1, 2, 3, ...; the last value repeats. */
const BACKOFF_MS = [1000, 2000, 5000, 10000];

/** No newly decoded frame, or "disconnected", for this long: the connection is rebuilt. */
const STALL_MS = 5000;
const HEALTH_INTERVAL_MS = 1000;

const UNREACHABLE_TEXT = 'Insight not reachable';

/**
 * What a retried answer's error code means to someone looking at the tile. `no_video`,
 * `codec_changed` and `negotiation_failed` are Insight's own (its offer route); `insight_unreachable`
 * is the demos' relay's, when Insight does not answer it.
 */
const WAITING_TEXT: Readonly<Record<string, string>> = {
  no_video: 'Waiting for video',
  codec_changed: 'Video format changed',
  insight_unreachable: UNREACHABLE_TEXT,
  negotiation_failed: 'Could not connect',
};

/** The answers of a proxy whose server does not answer, when they carry no code of Insight's. */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

/** Where the connection posts its offer, how long the browser holds the video, and its log. */
export interface InsightConnectionOptions {
  /** The address the offer is posted to, as is. */
  readonly offerUrl: string;
  /** The receiver's `jitterBufferTarget` in ms; unset leaves the receiver alone. */
  readonly videoBufferMs?: number;
  /** Told each step of the connection, for an app's debug log; unset logs nothing. */
  readonly log?: (event: string, details?: unknown) => void;
}

/** What arrives on a connected channel, sampled once a second. */
export interface NeatInsightVideoStats {
  /** The video's codec as the browser names it ("H264", "H265", "VP8"), or null before it says. */
  readonly codec: string | null;
  /** The decoded frame's size in pixels, or null before the browser reports it. */
  readonly width: number | null;
  readonly height: number | null;
  /** Decoded frames per second, or null before the browser reports it. */
  readonly framesPerSecond: number | null;
  /** The video's bitrate over the last second, in bits per second. */
  readonly bitsPerSecond: number;
}

/** What the connection reports, each call a change (or the same value again). */
export interface InsightConnectionEvents {
  /** The channel's video once a track arrives, null when the connection is dropped. */
  stream(stream: MediaStream | null): void;
  /** While retrying after an answer that says why, a short text saying so; null otherwise. */
  waiting(text: string | null): void;
  /** Why the connection stopped for good; called once, after which nothing else is reported. */
  failure(text: string): void;
  /** The mean jitter-buffer delay per frame over the last second, or null. */
  videoDelayMs(ms: number | null): void;
  /** What arrives, once a second while connected; null without a connected peer. */
  stats(stats: NeatInsightVideoStats | null): void;
  /** A text message of the `metadata` data channel, `receivedAt` on `performance.now()`. */
  metadata(text: string, receivedAt: number): void;
}

/** An open connection: closed for good with `close`, its video buffer changed at any time. */
export interface InsightConnection {
  /** Closes the connection for good; calling it again does nothing. */
  close(): void;
  /** Holds the video for `ms` from now on, this connection and the ones that replace it. */
  setVideoBufferMs(ms: number | undefined): void;
}

/** What the health check keeps of a connected peer between samples. */
interface Health {
  framesDecoded: number;
  progressAt: number;
  disconnectedSince: number | null;
  /** The jitter buffer counters at the previous sample, for the per-second mean. */
  delaySeconds: number | null;
  emittedCount: number;
  /** The bytes received and the report's time at the previous sample, for the bitrate. */
  bytesReceived: number | null;
  sampledAt: number | null;
}

/** The fields of an inbound video report that the sample reads. */
type InboundVideo = Pick<
  RTCInboundRtpStreamStats,
  | 'framesDecoded'
  | 'jitterBufferDelay'
  | 'jitterBufferEmittedCount'
  | 'bytesReceived'
  | 'frameWidth'
  | 'frameHeight'
  | 'framesPerSecond'
  | 'codecId'
  | 'timestamp'
>;

/** Starts connecting at once. */
export function openInsightConnection(
  options: InsightConnectionOptions,
  events: InsightConnectionEvents,
): InsightConnection {
  const log = options.log ?? (() => undefined);
  let videoBufferMs = options.videoBufferMs;
  let closed = false;
  let peer: RTCPeerConnection | null = null;
  let receiver: RTCRtpReceiver | null = null;
  let health: Health | null = null;
  let failures = 0;
  let checking = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let healthTimer: ReturnType<typeof setInterval> | null = null;

  const clearRetry = (): void => {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const dropPeer = (): void => {
    const pc = peer;
    peer = null;
    receiver = null;
    health = null;
    events.videoDelayMs(null);
    events.stats(null);
    pc?.close();
  };

  const close = (): void => {
    if (closed) return;
    closed = true;
    clearRetry();
    if (healthTimer !== null) clearInterval(healthTimer);
    healthTimer = null;
    dropPeer();
    events.stream(null);
    events.waiting(null);
    log('closed');
  };

  const fail = (text: string): void => {
    close();
    log('failed', text);
    events.failure(text);
  };

  const retry = (reason: string): void => {
    if (closed) return;
    dropPeer();
    events.stream(null);
    const delay = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)];
    failures += 1;
    clearRetry();
    log('retrying', { reason, inMs: delay });
    retryTimer = setTimeout(() => void attempt(), delay);
  };

  const attempt = async (): Promise<void> => {
    if (closed) return;
    clearRetry();
    dropPeer();
    const pc = new RTCPeerConnection();
    peer = pc;
    const transceiver = pc.addTransceiver('video', { direction: 'recvonly' });
    receiver = transceiver.receiver;
    if (videoBufferMs !== undefined) applyJitterBufferTarget(receiver, videoBufferMs);
    log('connecting', { offerUrl: options.offerUrl, videoBufferMs });
    const metadata = pc.createDataChannel('metadata', { ordered: true, maxRetransmits: 0 });
    metadata.onmessage = (event: MessageEvent) => {
      if (pc !== peer || typeof event.data !== 'string') return;
      events.metadata(event.data, performance.now());
    };
    pc.ontrack = (event: RTCTrackEvent) => {
      if (pc !== peer || event.track.kind !== 'video') return;
      log('track');
      events.waiting(null);
      events.stream(event.streams[0] ?? new MediaStream([event.track]));
    };
    pc.onconnectionstatechange = () => {
      if (pc !== peer) return;
      log('connection state', pc.connectionState);
      if (pc.connectionState === 'connected') failures = 0;
      else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        retry(`connection ${pc.connectionState}`);
      }
    };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // fetch rejects only when no answer came at all: whatever serves the offer is out of reach.
      const response = await fetch(options.offerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: offer.type, sdp: offer.sdp }),
      }).catch(() => {
        throw new OfferError(null, { code: null, message: null });
      });
      if (!response.ok) throw new OfferError(response.status, await errorOf(response));
      const answer = (await response.json()) as RTCSessionDescriptionInit;
      if (closed || pc !== peer) return;
      await pc.setRemoteDescription(answer);
      log('answered');
      health = {
        framesDecoded: -1,
        progressAt: Date.now(),
        disconnectedSince: null,
        delaySeconds: null,
        emittedCount: 0,
        bytesReceived: null,
        sampledAt: null,
      };
    } catch (error) {
      if (pc !== peer) return;
      if (error instanceof OfferError && error.final) {
        fail(error.failureText());
      } else {
        events.waiting(error instanceof OfferError ? error.waitingText() : null);
        retry(error instanceof Error ? `offer: ${error.message}` : 'offer failed');
      }
    }
  };

  const checkHealth = async (): Promise<void> => {
    const pc = peer;
    if (closed || checking || !pc || !health) return;
    checking = true;
    try {
      const reports = await pc.getStats();
      const inbound = inboundVideo(reports);
      const current = health;
      if (pc !== peer || !current) return;
      const now = Date.now();
      const framesDecoded = inbound?.framesDecoded ?? 0;
      if (framesDecoded > current.framesDecoded) {
        current.framesDecoded = framesDecoded;
        current.progressAt = now;
      }
      const connected = pc.connectionState === 'connected';
      events.videoDelayMs(sampleDelay(current, connected, inbound));
      events.stats(connected && inbound ? sampleStats(current, inbound, reports) : null);
      if (pc.connectionState === 'disconnected') current.disconnectedSince ??= now;
      else current.disconnectedSince = null;
      const disconnected =
        current.disconnectedSince !== null && now - current.disconnectedSince >= STALL_MS;
      if (now - current.progressAt >= STALL_MS) retry('no new frame decoded');
      else if (disconnected) retry('disconnected');
    } catch {
      // stats are unavailable on a closing peer: the next tick looks again
    } finally {
      checking = false;
    }
  };

  if (typeof RTCPeerConnection !== 'function') {
    closed = true;
    events.failure('This browser has no WebRTC');
    return { close: () => undefined, setVideoBufferMs: () => undefined };
  }
  healthTimer = setInterval(() => void checkHealth(), HEALTH_INTERVAL_MS);
  void attempt();
  return {
    close,
    setVideoBufferMs(ms) {
      videoBufferMs = ms;
      if (receiver !== null && ms !== undefined) applyJitterBufferTarget(receiver, ms);
    },
  };
}

/** The report of the inbound video, or null before there is one. */
function inboundVideo(reports: RTCStatsReport): InboundVideo | null {
  for (const report of reports.values()) {
    if (report.type === 'inbound-rtp' && report.kind === 'video') return report as InboundVideo;
  }
  return null;
}

/** The mean jitter-buffer delay per frame since the previous sample, in ms, or null. */
function sampleDelay(
  current: Health,
  connected: boolean,
  video: InboundVideo | null,
): number | null {
  const delaySeconds = video?.jitterBufferDelay ?? 0;
  const emittedCount = video?.jitterBufferEmittedCount ?? 0;
  const frames = emittedCount - current.emittedCount;
  const seconds = delaySeconds - (current.delaySeconds ?? 0);
  const hadBaseline = current.delaySeconds !== null;
  current.delaySeconds = delaySeconds;
  current.emittedCount = emittedCount;
  return connected && hadBaseline && frames > 0 ? (seconds / frames) * 1000 : null;
}

/** What arrives, from the inbound video report and the codec report it names. */
function sampleStats(
  current: Health,
  video: InboundVideo,
  reports: RTCStatsReport,
): NeatInsightVideoStats {
  const bytes = video.bytesReceived ?? null;
  const seconds = current.sampledAt === null ? 0 : (video.timestamp - current.sampledAt) / 1000;
  const bitsPerSecond =
    seconds > 0 && bytes !== null && current.bytesReceived !== null
      ? ((bytes - current.bytesReceived) * 8) / seconds
      : 0;
  current.bytesReceived = bytes;
  current.sampledAt = video.timestamp;
  return {
    codec: codecOf(reports, video.codecId),
    width: video.frameWidth ?? null,
    height: video.frameHeight ?? null,
    framesPerSecond: video.framesPerSecond ?? null,
    bitsPerSecond,
  };
}

/** The encoding of the codec report `codecId` names ("video/H264" is "H264"), or null. */
function codecOf(reports: RTCStatsReport, codecId: string | undefined): string | null {
  const mimeType = codecId === undefined ? undefined : reports.get(codecId)?.mimeType;
  if (typeof mimeType !== 'string') return null;
  return mimeType.split('/')[1] || null;
}

/**
 * Asks the receiver to hold the video for `ms`. A browser without `jitterBufferTarget` (Firefox)
 * plays at once, and one that rejects the value is left alone rather than failing the attempt.
 */
function applyJitterBufferTarget(receiver: RTCRtpReceiver, ms: number): void {
  if (!('jitterBufferTarget' in receiver)) return;
  try {
    receiver.jitterBufferTarget = ms;
  } catch {
    // out of the browser's range: play without the buffer
  }
}

/** The `{"error": {"code", "message"}}` body that Insight and the relays answer with, if any. */
async function errorOf(
  response: Response,
): Promise<{ code: string | null; message: string | null }> {
  try {
    const { error } = (await response.json()) as { error?: { code?: unknown; message?: unknown } };
    return {
      code: typeof error?.code === 'string' ? error.code : null,
      message: typeof error?.message === 'string' ? error.message : null,
    };
  } catch {
    return { code: null, message: null };
  }
}

/** Why a post brought no answer to apply: an error answer, or with `status` null, none at all. */
class OfferError extends Error {
  readonly code: string | null;
  private readonly detail: string | null;

  constructor(
    readonly status: number | null,
    body: { code: string | null; message: string | null },
  ) {
    super(status === null ? 'no answer' : `HTTP ${status}`);
    this.code = body.code;
    this.detail = body.message;
  }

  /** A 4xx is final: the same offer would be refused again. */
  get final(): boolean {
    return this.status !== null && this.status >= 400 && this.status < 500;
  }

  /** The words for a refusal for good, as Insight's viewer says them. */
  failureText(): string {
    if (this.status === 415) return 'Codec not supported by this browser';
    return this.detail ?? `Connection failed: HTTP ${this.status}`;
  }

  /** The words while retrying, or null for an answer that does not say why. */
  waitingText(): string | null {
    if (this.code !== null)
      return Object.hasOwn(WAITING_TEXT, this.code) ? WAITING_TEXT[this.code] : null;
    return this.status === null || GATEWAY_STATUSES.has(this.status) ? UNREACHABLE_TEXT : null;
  }
}
