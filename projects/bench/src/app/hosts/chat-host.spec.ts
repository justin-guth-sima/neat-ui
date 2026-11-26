import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NeatChatTranscript, NeatMessageBox } from '@sima/neat-ui/chat';
import { neatSpeakable } from '@sima/neat-ui/markdown';
import { MOCKUP_REPLY } from '../synth/chat-load';
import {
  CHAT_WARMUP_MS,
  ChatHost,
  chatQuery,
  HEARD_MS,
  HEARD_QUESTION,
  LISTEN_MS,
  TRANSCRIBE_MS,
} from './chat-host';

/** A host on `query`, its transcript and box. */
function host(values: Record<string, string>) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(values) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(ChatHost);
  fixture.detectChanges();
  const transcript = fixture.debugElement.query(By.directive(NeatChatTranscript))
    .componentInstance as NeatChatTranscript;
  const box = fixture.debugElement.query(By.directive(NeatMessageBox))
    .componentInstance as NeatMessageBox;
  const step = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  return { fixture, transcript, box, step };
}

/** A microphone, MediaRecorder and AudioContext as Chrome's fake devices give them. */
function fakeMicrophone() {
  const track = { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
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
        const data = new Blob(['x'.repeat(4000)], { type: this.mimeType });
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
    decodeAudioData = () => Promise.resolve({ duration: 2.98 });
  }
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('AudioContext', Context);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve({ getTracks: () => [track] }) },
  });
}

describe('ChatHost', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (navigator as { mediaDevices?: unknown }).mediaDevices;
    delete window.benchChat;
  });

  it('reads its variants and load from the query', () => {
    const query = (values: Record<string, string>) => convertToParamMap(values);
    expect(chatQuery(query({}))).toEqual({
      text: 'plain',
      picture: 'coming-into-focus',
      glow: 'comet',
      rate: 50,
      wait: 1300,
      pieces: 500,
      reply: 'prose',
      listen: 'none',
      speak: 'none',
      measure: true,
    });
    expect(
      chatQuery(
        query({
          text: 'decrypt',
          picture: 'viewfinder',
          glow: 'ring',
          rate: '20',
          wait: '3000',
          pieces: '80',
          reply: 'code',
          measure: '0',
        }),
      ),
    ).toEqual({
      text: 'decrypt',
      picture: 'viewfinder',
      glow: 'ring',
      rate: 20,
      wait: 3000,
      pieces: 80,
      reply: 'code',
      listen: 'none',
      speak: 'none',
      measure: false,
    });
    // Nonsense falls back to the defaults.
    expect(
      chatQuery(query({ text: 'sparkle', glow: 'none', rate: '-3', pieces: 'many', wait: 'x' })),
    ).toMatchObject({ text: 'plain', glow: 'none', rate: 50, pieces: 500, wait: 1300 });
  });

  it('streams the reply after the wait', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                text: 'focus',
                glow: 'ring',
                pieces: '20',
                rate: '50',
                wait: '1000',
                measure: '0',
              }),
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ChatHost);
    fixture.detectChanges();
    const transcript = fixture.debugElement.query(By.directive(NeatChatTranscript))
      .componentInstance as NeatChatTranscript;
    const box = fixture.debugElement.query(By.directive(NeatMessageBox))
      .componentInstance as NeatMessageBox;
    expect(transcript.textMotion()).toBe('focus');
    expect(box.glow()).toBe('ring');
    // The question, with the shelf picture, from the start.
    expect(transcript.messages()).toHaveLength(1);
    expect(transcript.messages()[0].pictures?.[0].src).toBe('examples/shelf.webp');
    await vi.advanceTimersByTimeAsync(CHAT_WARMUP_MS);
    fixture.detectChanges();
    expect(transcript.messages()[1].state).toBe('waiting');
    expect(box.activity()).toBe('waiting');
    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();
    expect(transcript.messages()[1].state).toBe('streaming');
    expect(box.activity()).toBe('streaming');
    await vi.advanceTimersByTimeAsync(20 * 30);
    fixture.detectChanges();
    expect(transcript.messages()[1].state).toBe('done');
    expect(box.activity()).toBe('idle');
    fixture.destroy();
  });

  it('reads listen and speak from the query', () => {
    const query = (values: Record<string, string>) => chatQuery(convertToParamMap(values));
    expect(query({ listen: 'radial', speak: 'equalizer', reply: 'mockup' })).toMatchObject({
      listen: 'radial',
      speak: 'equalizer',
      reply: 'mockup',
    });
    expect(query({ listen: 'shout', speak: 'sing' })).toMatchObject({
      listen: 'none',
      speak: 'none',
    });
  });

  it('a listen run records, transcribes and adds a heard question', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    fakeMicrophone();
    const t = host({ listen: 'radial', pieces: '10', wait: '500', measure: '0' });
    expect(t.box.talk()).toBe(true);
    expect(t.box.listeningMotion()).toBe('radial');
    expect(t.transcript.listeningMotion()).toBe('radial');
    expect(t.transcript.messages()).toEqual([]);
    await t.step(CHAT_WARMUP_MS);
    expect(t.box.recording()).toBe(true);
    await t.step(LISTEN_MS);
    expect(t.box.recording()).toBe(false);
    expect(t.box.transcribing()).toBe(true);
    await t.step(TRANSCRIBE_MS);
    expect(t.box.transcribing()).toBe(false);
    expect(t.transcript.messages()).toEqual([
      expect.objectContaining({ role: 'user', text: HEARD_QUESTION, heard: true }),
    ]);
    await t.step(HEARD_MS);
    expect(t.transcript.messages()[1]?.state).toBe('waiting');
    t.fixture.destroy();
  });

  it('a speak run speaks each complete sentence in order', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const t = host({ speak: 'equalizer', reply: 'mockup', wait: '500', measure: '0' });
    expect(t.transcript.speakingMotion()).toBe('equalizer');
    await t.step(CHAT_WARMUP_MS + 500);
    const spoken: number[] = [];
    for (let i = 0; i < 200; i++) {
      await t.step(50);
      const from = t.transcript.messages()[1]?.speech?.from;
      if (from !== undefined && spoken.at(-1) !== from) spoken.push(from);
    }
    const order = neatSpeakable(MOCKUP_REPLY).map((sentence) => sentence.from);
    expect(order).toHaveLength(2);
    expect(spoken.slice(0, 2)).toEqual(order);
    t.fixture.destroy();
  });
});
