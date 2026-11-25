import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NeatChatTranscript, NeatMessageBox } from '@sima/neat-ui/chat';
import { CHAT_WARMUP_MS, ChatHost, chatQuery } from './chat-host';

describe('ChatHost', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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
});
