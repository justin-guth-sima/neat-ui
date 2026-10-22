import { parseMetadataMessage } from './metadata-message';

describe('parseMetadataMessage', () => {
  it.each(['not json', '[]', '{}', '{"type": 3}', 'null', '"text"', '42'])(
    'returns null for %s',
    (text) => {
      expect(parseMetadataMessage(text)).toBeNull();
    },
  );

  it('keeps _insight.rtp_timestamp and data as received', () => {
    const data = { objects: [{ bbox: [1, 2, 3, 4], extra: { nested: true } }], unknown_field: 7 };
    const message = parseMetadataMessage(
      JSON.stringify({ type: 'object-detection', data, _insight: { rtp_timestamp: 90_000 } }),
    );

    expect(message).toEqual({
      type: 'object-detection',
      data,
      _insight: { rtp_timestamp: 90_000 },
    });
  });

  it('accepts a message without data', () => {
    expect(parseMetadataMessage('{"type": "heartbeat"}')).toEqual({ type: 'heartbeat' });
  });
});
