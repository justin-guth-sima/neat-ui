import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';
import { CHAT_CLOCK } from '../chat-clock';
import type { MicDeps } from './mic-recorder';

/**
 * What push-to-talk's recorder takes from the browser: the window's secure context, its
 * microphone, MediaRecorder, a new AudioContext per recording, the chat clock and timers. Specs
 * provide fakes. Internal.
 */
export const MIC_DEPS = new InjectionToken<MicDeps>('MIC_DEPS', {
  providedIn: 'root',
  factory: (): MicDeps => {
    const window = inject(DOCUMENT).defaultView;
    return {
      isSecureContext: window?.isSecureContext ?? false,
      mediaDevices: window?.navigator.mediaDevices,
      MediaRecorder: window?.MediaRecorder,
      audioContext: () => new window!.AudioContext(),
      clock: inject(CHAT_CLOCK),
      setTimeout: (run, ms) => window!.setTimeout(run, ms),
      clearTimeout: (handle) => window!.clearTimeout(handle),
    };
  },
});
