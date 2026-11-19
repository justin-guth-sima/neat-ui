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

/** Where the connection posts its offer, and how long the browser should hold the video. */
export interface InsightConnectionOptions {
  /** The address the offer is posted to, as is. */
  readonly offerUrl: string;
  /** The receiver's `jitterBufferTarget` in ms; unset leaves the receiver alone. */
  readonly videoBufferMs?: number;
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
  /** A text message of the `metadata` data channel, `receivedAt` on `performance.now()`. */
  metadata(text: string, receivedAt: number): void;
}

/** What the health check keeps of a connected peer: the last frame count and when it last grew. */
interface Health {
  framesDecoded: number;
  progressAt: number;
  disconnectedSince: number | null;
  /** The jitter buffer counters at the previous sample, for the per-second mean. */
  delaySeconds: number | null;
  emittedCount: number;
}

/** Starts connecting at once; returns the function that closes the connection for good. */
export function openInsightConnection(
  options: InsightConnectionOptions,
  events: InsightConnectionEvents,
): () => void {
  let closed = false;
  let peer: RTCPeerConnection | null = null;
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
    health = null;
    events.videoDelayMs(null);
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
  };

  const fail = (text: string): void => {
    close();
    events.failure(text);
  };

  const retry = (): void => {
    if (closed) return;
    dropPeer();
    events.stream(null);
    const delay = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)];
    failures += 1;
    clearRetry();
    retryTimer = setTimeout(() => void attempt(), delay);
  };

  const attempt = async (): Promise<void> => {
    if (closed) return;
    clearRetry();
    dropPeer();
    const pc = new RTCPeerConnection();
    peer = pc;
    const transceiver = pc.addTransceiver('video', { direction: 'recvonly' });
    if (options.videoBufferMs !== undefined) {
      applyJitterBufferTarget(transceiver.receiver, options.videoBufferMs);
    }
    const metadata = pc.createDataChannel('metadata', { ordered: true, maxRetransmits: 0 });
    metadata.onmessage = (event: MessageEvent) => {
      if (pc !== peer || typeof event.data !== 'string') return;
      events.metadata(event.data, performance.now());
    };
    pc.ontrack = (event: RTCTrackEvent) => {
      if (pc !== peer || event.track.kind !== 'video') return;
      events.waiting(null);
      events.stream(event.streams[0] ?? new MediaStream([event.track]));
    };
    pc.onconnectionstatechange = () => {
      if (pc !== peer) return;
      if (pc.connectionState === 'connected') failures = 0;
      else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') retry();
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
      health = {
        framesDecoded: -1,
        progressAt: Date.now(),
        disconnectedSince: null,
        delaySeconds: null,
        emittedCount: 0,
      };
    } catch (error) {
      if (pc !== peer) return;
      if (error instanceof OfferError && error.final) {
        fail(error.failureText());
      } else {
        events.waiting(error instanceof OfferError ? error.waitingText() : null);
        retry();
      }
    }
  };

  const checkHealth = async (): Promise<void> => {
    const pc = peer;
    if (closed || checking || !pc || !health) return;
    checking = true;
    try {
      let framesDecoded = 0;
      let delaySeconds = 0;
      let emittedCount = 0;
      (await pc.getStats()).forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          framesDecoded = report.framesDecoded ?? 0;
          delaySeconds = report.jitterBufferDelay ?? 0;
          emittedCount = report.jitterBufferEmittedCount ?? 0;
        }
      });
      const current = health;
      if (pc !== peer || !current) return;
      const now = Date.now();
      if (framesDecoded > current.framesDecoded) {
        current.framesDecoded = framesDecoded;
        current.progressAt = now;
      }
      sampleDelay(current, pc.connectionState === 'connected', delaySeconds, emittedCount);
      if (pc.connectionState === 'disconnected') current.disconnectedSince ??= now;
      else current.disconnectedSince = null;
      const disconnected =
        current.disconnectedSince !== null && now - current.disconnectedSince >= STALL_MS;
      if (now - current.progressAt >= STALL_MS || disconnected) retry();
    } catch {
      // stats are unavailable on a closing peer: the next tick looks again
    } finally {
      checking = false;
    }
  };

  const sampleDelay = (
    current: Health,
    connected: boolean,
    delaySeconds: number,
    emittedCount: number,
  ): void => {
    const frames = emittedCount - current.emittedCount;
    const seconds = delaySeconds - (current.delaySeconds ?? 0);
    const hadBaseline = current.delaySeconds !== null;
    current.delaySeconds = delaySeconds;
    current.emittedCount = emittedCount;
    events.videoDelayMs(connected && hadBaseline && frames > 0 ? (seconds / frames) * 1000 : null);
  };

  if (typeof RTCPeerConnection !== 'function') {
    closed = true;
    events.failure('This browser has no WebRTC');
    return () => undefined;
  }
  healthTimer = setInterval(() => void checkHealth(), HEALTH_INTERVAL_MS);
  void attempt();
  return close;
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
