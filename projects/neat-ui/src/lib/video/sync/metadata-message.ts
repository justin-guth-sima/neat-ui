/**
 * One metadata message from the stream's data channel. `_insight.rtp_timestamp` identifies the
 * video frame the message describes; messages without it can only be matched by arrival order.
 */
export interface NeatMetadataMessage {
  type: string;
  timestamp?: number;
  frame_id?: unknown;
  data?: unknown;
  _insight?: { rtp_timestamp?: number };
}

/**
 * Parses a data-channel text message. Returns null for anything that is not a JSON object with a
 * string `type`, so a caller can drop it without reasoning about the payload. Everything else,
 * `data` and `_insight` included, is kept exactly as received.
 */
export function parseMetadataMessage(text: string): NeatMetadataMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  if (typeof (parsed as { type?: unknown }).type !== 'string') return null;
  return parsed as NeatMetadataMessage;
}
