import { TestBed } from '@angular/core/testing';
import { PushToTalk } from './1-push-to-talk.example';

/** A microphone, a recorder and an audio context for the example, as a browser would give them. */
function fakeBrowser() {
  const track = { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const stream = { getTracks: () => [track] };
  class Recorder extends EventTarget {
    static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus';
    state = 'inactive';
    readonly mimeType: string;
    constructor(_stream: unknown, options?: { mimeType?: string }) {
      super();
      this.mimeType = options?.mimeType ?? '';
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => {
        const data = new Blob(['x'.repeat(38_000)], { type: this.mimeType });
        this.dispatchEvent(Object.assign(new Event('dataavailable'), { data }));
        this.dispatchEvent(new Event('stop'));
      });
    }
  }
  class Context {
    state = 'running';
    resume = () => Promise.resolve();
    close = () => Promise.resolve();
    createMediaStreamSource = () => ({ connect: vi.fn() });
    createAnalyser = () => ({ fftSize: 2048, getFloatTimeDomainData: vi.fn() });
    decodeAudioData = () => Promise.resolve({ duration: 2.4 });
  }
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('AudioContext', Context);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve(stream) },
  });
  URL.createObjectURL = vi.fn(() => 'blob:recording');
  URL.revokeObjectURL = vi.fn();
}

describe('the push-to-talk examples', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  });

  it("the example shows the last recording's length and size", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    fakeBrowser();
    const fixture = TestBed.createComponent(PushToTalk);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector('neat-push-to-talk button') as HTMLButtonElement;
    const key = (type: string) =>
      button.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', bubbles: true }));
    key('keydown');
    key('keyup');
    await vi.advanceTimersByTimeAsync(2400);
    key('keydown');
    key('keyup');
    await vi.advanceTimersByTimeAsync(10);
    fixture.detectChanges();
    expect(host.querySelector('.last')?.textContent).toBe('Last recording: 2.4 s · 38 kB');
    expect(host.querySelector('audio')?.getAttribute('src')).toBe('blob:recording');
    expect(host.querySelector('neat-push-to-talk')!.getAttribute('data-state')).toBe(
      'transcribing',
    );
    await vi.advanceTimersByTimeAsync(600);
    fixture.detectChanges();
    expect(host.querySelector('neat-push-to-talk')!.getAttribute('data-state')).toBe('idle');
  });
});
