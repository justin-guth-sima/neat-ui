/**
 * Why the microphone or the camera could not be used: refused by the visitor or the browser
 * (`blocked`), no such device (`missing`), taken by another program (`busy`), a page that is not a
 * secure context (`insecure`), or a browser without the API (`unsupported`). Internal.
 */
export type MediaProblem = 'blocked' | 'missing' | 'busy' | 'insecure' | 'unsupported';

/** What a failed getUserMedia (or a missing API) means. */
export function mediaProblemOf(error: unknown): MediaProblem {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'blocked';
    case 'NotReadableError':
    case 'AbortError':
      return 'busy';
    default:
      // NotFoundError, OverconstrainedError and anything a browser invents: no device to use.
      return 'missing';
  }
}

/** What push-to-talk says in place for each end that is no recording. */
export const MIC_WORDS: Readonly<Record<MediaProblem | 'short', string>> = {
  blocked: 'Microphone blocked',
  missing: 'No microphone',
  busy: 'Microphone in use',
  insecure: 'Microphone needs HTTPS',
  unsupported: 'Recording not supported',
  short: 'Too short',
};

/** What the camera dialog says in place of its preview for each problem. */
export const CAMERA_WORDS: Readonly<Record<MediaProblem, string>> = {
  blocked: 'Camera blocked',
  missing: 'No camera',
  busy: 'Camera in use',
  insecure: 'Camera needs HTTPS',
  unsupported: 'No camera',
};
