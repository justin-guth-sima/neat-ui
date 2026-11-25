import { TestBed } from '@angular/core/testing';
import { Conversation } from './1-conversation.example';
import { States } from './2-states.example';
import { Motion } from './3-motion.example';
import { HeardQuestion } from './4-heard-question.example';
import { ReadAloud } from './5-read-aloud.example';
import { By } from '@angular/platform-browser';
import { NeatChatTranscript } from '@sima/neat-ui/chat';
import { neatSpeakable } from '@sima/neat-ui/markdown';

describe('the transcript examples', () => {
  afterEach(() => vi.useRealTimers());

  it('the transcript example renders the conversation and finishes the reply', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Conversation);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('img[alt="A kitchen shelf"]')).not.toBeNull();
    expect(host.textContent).toContain('Waiting for the reply');
    await vi.advanceTimersByTimeAsync(4000);
    fixture.detectChanges();
    expect(host.querySelector('[data-role="assistant"]')?.textContent).toContain('pomodoro');
    expect(host.textContent).toContain('first word 0.22 s');
  });

  it('the states example shows a stopped, a failed and a waiting reply, and New chat empties it', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(States);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.stopped')).not.toBeNull();
    expect(host.querySelector('neat-callout')?.textContent).toContain('too long');
    const button = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('New chat'),
    )!;
    button.click();
    fixture.detectChanges();
    expect(host.querySelectorAll('[data-message]')).toHaveLength(0);
  });

  it("the motion example's selects reach the transcript", async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Motion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('neat-select')).toHaveLength(2);
    fixture.componentInstance['textMotion'].set('drop-in');
    fixture.componentInstance['pictureMotion'].set('viewfinder');
    fixture.detectChanges();
    // The next round reads the picture in the viewfinder, then streams the reply in drop-in.
    const until = async (seen: () => boolean) => {
      for (let step = 0; step < 200 && !seen(); step++) {
        await vi.advanceTimersByTimeAsync(100);
        fixture.detectChanges();
      }
      return seen();
    };
    const reading = () => host.querySelector('neat-chat-picture-reading');
    expect(await until(() => reading()?.getAttribute('data-motion') === 'viewfinder')).toBe(true);
    const markdown = () => host.querySelector('neat-markdown');
    expect(await until(() => markdown()?.getAttribute('data-motion') === 'drop-in')).toBe(true);
  });

  it('the heard question example loops through the motions', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HeardQuestion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const seen: (string | null)[] = [];
    for (let i = 0; i < 16; i++) {
      await vi.advanceTimersByTimeAsync(500);
      fixture.detectChanges();
      const arrival = host.querySelector('neat-chat-heard');
      const motion = arrival?.getAttribute('data-motion') ?? null;
      if (motion && seen.at(-1) !== motion) seen.push(motion);
    }
    expect(seen.slice(0, 3)).toEqual(['ring-and-waveform', 'radial', 'ring-and-waveform']);
    expect(host.textContent).toContain('heard in 0.31 s · English');
  });

  it("the read aloud example speaks neatSpeakable's sentences in order", async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(ReadAloud);
    fixture.detectChanges();
    const transcript = fixture.debugElement.query(By.directive(NeatChatTranscript))
      .componentInstance as NeatChatTranscript;
    const reply = () => transcript.messages().find((message) => message.role === 'assistant')!;
    const spoken: number[] = [];
    for (let i = 0; i < 200; i++) {
      await vi.advanceTimersByTimeAsync(100);
      fixture.detectChanges();
      const from = reply().speech?.from;
      if (from !== undefined && spoken.at(-1) !== from) spoken.push(from);
    }
    const order = neatSpeakable(reply().text).map((sentence) => sentence.from);
    expect(spoken.slice(0, order.length)).toEqual(order);
    expect(order).toHaveLength(2);
    vi.unstubAllGlobals();
  });
});
