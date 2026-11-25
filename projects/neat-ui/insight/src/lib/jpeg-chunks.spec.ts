import { JPEG_8X8_BASELINE } from './jpeg-fixture.testing';
import { JpegAssembler, jpegSize, parseJpegChunk, type JpegChunk } from './jpeg-chunks';

/** A data channel message: the 8-byte big-endian header, then the bytes. */
function chunk(timestamp: number, index: number, count: number, bytes: number[]): ArrayBuffer {
  const message = new Uint8Array(8 + bytes.length);
  const view = new DataView(message.buffer);
  view.setUint32(0, timestamp);
  view.setUint16(4, index);
  view.setUint16(6, count);
  message.set(bytes, 8);
  return message.buffer;
}

function parsed(timestamp: number, index: number, count: number, bytes: number[]): JpegChunk {
  const result = parseJpegChunk(chunk(timestamp, index, count, bytes));
  if (!result) throw new Error('the chunk should parse');
  return result;
}

describe('parseJpegChunk', () => {
  it('reads the header big-endian: timestamp, index, count, then the bytes', () => {
    const message = new Uint8Array([0xfe, 0xdc, 0xba, 0x98, 0, 2, 0, 5, 7, 8, 9]);
    const result = parseJpegChunk(message.buffer);
    expect(result?.timestamp).toBe(0xfedcba98);
    expect(result?.index).toBe(2);
    expect(result?.count).toBe(5);
    expect(Array.from(result?.bytes ?? [])).toEqual([7, 8, 9]);
  });

  it('drops a message of 8 bytes or less, an index not below its count, and a count over 280', () => {
    expect(parseJpegChunk(chunk(1, 0, 1, []))).toBeNull();
    expect(parseJpegChunk(chunk(1, 3, 3, [1]))).toBeNull();
    expect(parseJpegChunk(chunk(1, 0, 0, [1]))).toBeNull();
    expect(parseJpegChunk(chunk(1, 0, 281, [1]))).toBeNull();
    expect(parseJpegChunk(chunk(1, 279, 280, [1]))).not.toBeNull();
  });
});

describe('JpegAssembler', () => {
  it('gives a frame in one chunk at once', () => {
    const frame = new JpegAssembler().accept(parsed(5, 0, 1, [1, 2, 3]));
    expect(frame?.timestamp).toBe(5);
    expect(frame?.parts.map((part) => Array.from(part))).toEqual([[1, 2, 3]]);
    expect(frame?.byteLength).toBe(3);
  });

  it('gives a frame of several chunks once its last one is in, its parts in index order', () => {
    const assembler = new JpegAssembler();
    expect(assembler.accept(parsed(5, 2, 3, [5]))).toBeNull();
    expect(assembler.accept(parsed(5, 0, 3, [1, 2]))).toBeNull();
    const frame = assembler.accept(parsed(5, 1, 3, [3, 4]));
    expect(frame?.parts.map((part) => Array.from(part))).toEqual([[1, 2], [3, 4], [5]]);
    expect(frame?.byteLength).toBe(5);
    expect(assembler.dropped).toBe(0);
  });

  it('drops and counts an unfinished frame when a chunk of a newer timestamp arrives', () => {
    const assembler = new JpegAssembler();
    expect(assembler.accept(parsed(1, 0, 2, [1]))).toBeNull();
    const frame = assembler.accept(parsed(2, 0, 1, [9]));
    expect(frame?.timestamp).toBe(2);
    expect(assembler.dropped).toBe(1);
  });

  it('starts a new frame on a chunk whose count differs, and counts the old one', () => {
    const assembler = new JpegAssembler();
    assembler.accept(parsed(1, 0, 3, [1]));
    expect(assembler.accept(parsed(1, 1, 2, [2]))).toBeNull();
    expect(assembler.dropped).toBe(1);
    const frame = assembler.accept(parsed(1, 0, 2, [3]));
    expect(frame?.parts.map((part) => Array.from(part))).toEqual([[3], [2]]);
  });

  it('ignores a repeated index', () => {
    const assembler = new JpegAssembler();
    expect(assembler.accept(parsed(1, 0, 2, [1]))).toBeNull();
    expect(assembler.accept(parsed(1, 0, 2, [1]))).toBeNull();
    const frame = assembler.accept(parsed(1, 1, 2, [2]));
    expect(frame?.parts.length).toBe(2);
    expect(frame?.byteLength).toBe(2);
  });
});

describe('jpegSize', () => {
  it('reads the size from the SOF0 of an 8×8 baseline JFIF', () => {
    expect(jpegSize(JPEG_8X8_BASELINE)).toEqual({ width: 8, height: 8 });
  });

  it('finds SOF0 after DQT and DRI segments', () => {
    const bytes = new Uint8Array([
      0xff,
      0xd8, // SOI
      0xff,
      0xe0,
      0x00,
      0x04,
      0x00,
      0x00, // APP0
      0xff,
      0xdb,
      0x00,
      0x05,
      0x00,
      0x01,
      0x02, // DQT
      0xff,
      0xdd,
      0x00,
      0x04,
      0x00,
      0x10, // DRI
      0xff,
      0xc0,
      0x00,
      0x0b,
      0x08,
      0x01,
      0xe0,
      0x02,
      0x80,
      0x01,
      0x01,
      0x11,
      0x00, // SOF0
    ]);
    expect(jpegSize(bytes)).toEqual({ width: 640, height: 480 });
  });

  it('says null for bytes without SOF0', () => {
    const progressive = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc2, 0x00, 0x0b, 0x08, 0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00,
    ]);
    expect(jpegSize(progressive)).toBeNull();
    expect(jpegSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
