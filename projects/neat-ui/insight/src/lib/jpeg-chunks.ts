/**
 * The JPEG data channel's chunks, parsed and put together into frames. Internal and pure: it
 * reads bytes with `DataView` and touches no browser API.
 *
 * The protocol lives in insight-next's `docs/contracts.md`, in "What a viewer's connection
 * carries". A message is one chunk of a frame: 4 bytes of timestamp, 2 of index and 2 of count
 * (all big-endian), then the chunk's bytes of the JPEG. The rules here for what a receiver drops
 * are that section's receiver rules: a message of 8 bytes or less, an index not below its count,
 * a count of 0 or over 280, and a frame that does not finish before another starts.
 */

/** The header in front of each chunk's bytes. */
export const JPEG_CHUNK_HEADER_BYTES = 8;

/** The most chunks one frame may be cut into. */
export const JPEG_MAX_CHUNKS = 280;

/** One data channel message, read. */
export interface JpegChunk {
  readonly timestamp: number;
  readonly index: number;
  readonly count: number;
  /** A view on the message after its header, not a copy. */
  readonly bytes: Uint8Array<ArrayBuffer>;
}

/** A frame's chunks in index order, as they came. */
export interface JpegFrame {
  readonly parts: readonly Uint8Array<ArrayBuffer>[];
  readonly timestamp: number;
  readonly byteLength: number;
}

/** Reads a message, or returns null when the protocol says to drop it. */
export function parseJpegChunk(data: ArrayBuffer): JpegChunk | null {
  if (data.byteLength <= JPEG_CHUNK_HEADER_BYTES) return null;
  const view = new DataView(data);
  const index = view.getUint16(4);
  const count = view.getUint16(6);
  if (count === 0 || count > JPEG_MAX_CHUNKS || index >= count) return null;
  return {
    timestamp: view.getUint32(0),
    index,
    count,
    bytes: new Uint8Array(data, JPEG_CHUNK_HEADER_BYTES),
  };
}

/** The frame being collected. */
interface Pending {
  readonly timestamp: number;
  readonly slots: (Uint8Array<ArrayBuffer> | undefined)[];
  filled: number;
}

/** Puts chunks together into frames, one frame at a time. */
export class JpegAssembler {
  private pending: Pending | null = null;
  private droppedFrames = 0;

  /** How many unfinished frames a chunk of another timestamp or count replaced. */
  get dropped(): number {
    return this.droppedFrames;
  }

  /** Takes a chunk; returns the frame when this chunk completed it. */
  accept(chunk: JpegChunk): JpegFrame | null {
    let pending = this.pending;
    if (
      pending &&
      (pending.timestamp !== chunk.timestamp || pending.slots.length !== chunk.count)
    ) {
      this.droppedFrames++;
      pending = null;
    }
    pending ??= {
      timestamp: chunk.timestamp,
      slots: new Array<Uint8Array<ArrayBuffer> | undefined>(chunk.count),
      filled: 0,
    };
    this.pending = pending;

    if (pending.slots[chunk.index] === undefined) {
      pending.slots[chunk.index] = chunk.bytes;
      pending.filled++;
    }
    if (pending.filled < chunk.count) return null;

    this.pending = null;
    const parts = pending.slots as Uint8Array<ArrayBuffer>[];
    return {
      parts,
      timestamp: pending.timestamp,
      byteLength: parts.reduce((sum, part) => sum + part.byteLength, 0),
    };
  }
}

const SOI = 0xd8;
const SOF0 = 0xc0;
/** Markers that stand alone, with no length: TEM, RSTn and SOI. */
const isStandalone = (marker: number): boolean =>
  marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8);

/**
 * The size from a baseline JPEG's first SOF0 segment, found by walking the markers from SOI by
 * their lengths. Null for anything else, a progressive (SOF2) frame included.
 */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;
  let at = 2;
  while (at + 4 <= bytes.byteLength) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at++; // fill byte
      continue;
    }
    if (isStandalone(marker)) {
      at += 2;
      continue;
    }
    if (marker === SOF0) {
      if (at + 9 > bytes.byteLength) return null;
      return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    }
    at += 2 + view.getUint16(at + 2);
  }
  return null;
}
