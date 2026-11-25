import { describe, expect, it } from 'vitest';
import { mediaError } from './media.testing';
import { CAMERA_WORDS, MIC_WORDS, mediaProblemOf } from './media-problem';

describe('mediaProblemOf', () => {
  it('maps each DOMException name to its problem', () => {
    expect(mediaProblemOf(mediaError('NotAllowedError'))).toBe('blocked');
    expect(mediaProblemOf(mediaError('SecurityError'))).toBe('blocked');
    expect(mediaProblemOf(mediaError('NotFoundError'))).toBe('missing');
    expect(mediaProblemOf(mediaError('OverconstrainedError'))).toBe('missing');
    expect(mediaProblemOf(mediaError('NotReadableError'))).toBe('busy');
    expect(mediaProblemOf(mediaError('AbortError'))).toBe('busy');
    expect(mediaProblemOf(mediaError('TypeError'))).toBe('missing');
    expect(mediaProblemOf('nonsense')).toBe('missing');
    expect(mediaProblemOf(null)).toBe('missing');
  });

  it("has the spec's words for blocked and missing", () => {
    expect(MIC_WORDS.blocked).toBe('Microphone blocked');
    expect(MIC_WORDS.missing).toBe('No microphone');
    expect(CAMERA_WORDS.blocked).toBe('Camera blocked');
    expect(CAMERA_WORDS.missing).toBe('No camera');
    expect(MIC_WORDS).toEqual({
      blocked: 'Microphone blocked',
      missing: 'No microphone',
      busy: 'Microphone in use',
      insecure: 'Microphone needs HTTPS',
      unsupported: 'Recording not supported',
      short: 'Too short',
    });
    expect(CAMERA_WORDS).toEqual({
      blocked: 'Camera blocked',
      missing: 'No camera',
      busy: 'Camera in use',
      insecure: 'Camera needs HTTPS',
      unsupported: 'No camera',
    });
  });
});
