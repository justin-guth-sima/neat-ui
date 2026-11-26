import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  NeatMarkdown,
  type NeatSpeakingMotion,
  type NeatSpeech,
  type NeatTextMotion,
} from '@sima/neat-ui/markdown';
import { steppedFrames } from './chat.testing';
import { CHAT_CLOCK } from './chat-clock';
import { HeardArrival } from './heard';
import { type NeatPictureMotion, PictureReading } from './picture-reading';
import type { NeatListeningMotion } from './push-to-talk';
import { HeardOrigin } from './voice/heard-origin';
import { NeatChatErrorActions, NeatChatMessageFooter, NeatChatTranscript } from './transcript';
import type { NeatChatMessage } from './types';
import transcriptStyles from './transcript.css' with { loader: 'text' };

@Component({
  imports: [NeatChatTranscript, NeatChatMessageFooter, NeatChatErrorActions],
  template: `
    <neat-chat-transcript
      [messages]="messages()"
      [textMotion]="textMotion()"
      [cloudWords]="cloudWords()"
      [pictureMotion]="pictureMotion()"
      [pictureFlight]="pictureFlight()"
      [listeningMotion]="listeningMotion()"
      [speakingMotion]="speakingMotion()"
      [pictureScale]="pictureScale()"
    >
      <ng-template neatChatMessageFooter let-message>
        <span class="footer">footer of {{ message.id }}</span>
      </ng-template>
      <ng-template neatChatErrorActions let-message>
        <button type="button" class="new-chat">New chat after {{ message.id }}</button>
      </ng-template>
    </neat-chat-transcript>
  `,
})
class Host {
  readonly messages = signal<NeatChatMessage[]>([]);
  readonly textMotion = signal<NeatTextMotion>('plain');
  readonly cloudWords = signal(12);
  readonly pictureMotion = signal<NeatPictureMotion>('coming-into-focus');
  readonly pictureFlight = signal(false);
  readonly listeningMotion = signal<NeatListeningMotion>('in-message-box');
  readonly speakingMotion = signal<NeatSpeakingMotion>('sentence');
  readonly pictureScale = signal(1);
}

function render(messages: NeatChatMessage[], motion: NeatTextMotion = 'plain') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.textMotion.set(motion);
  fixture.componentInstance.messages.set(messages);
  fixture.detectChanges();
  const element = fixture.nativeElement.querySelector('neat-chat-transcript') as HTMLElement;
  const set = (next: NeatChatMessage[]) => {
    fixture.componentInstance.messages.set(next);
    fixture.detectChanges();
  };
  return { fixture, element, set };
}

/** The transcript's scrolling log, given sizes jsdom does not lay out: 1000 high in 400, at the end. */
function scrollable(element: HTMLElement): HTMLElement {
  const log = element.querySelector('[role="log"]') as HTMLElement;
  let top = 600;
  Object.defineProperties(log, {
    scrollHeight: { configurable: true, get: () => 1000 },
    clientHeight: { configurable: true, get: () => 400 },
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (value: number) => (top = Math.min(value, 600)),
    },
  });
  log.scrollTo = ((options: ScrollToOptions) => {
    log.scrollTop = options.top ?? top;
    log.dispatchEvent(new Event('scroll'));
  }) as typeof log.scrollTo;
  // The follow rule read the box before the sizes existed: a scroll at the end lets it start there.
  log.dispatchEvent(new Event('scroll'));
  return log;
}

const question: NeatChatMessage = {
  id: 'q1',
  role: 'user',
  text: "What's on this shelf?",
  pictures: [{ id: 'p1', src: 'blob:shelf', name: 'shelf.jpg' }],
};

describe('NeatChatTranscript', () => {
  it("renders the user's message as a bubble with its pictures", () => {
    const { element } = render([question]);
    const bubble = element.querySelector('[data-role="user"]')!;
    expect(bubble.textContent).toContain("What's on this shelf?");
    const img = bubble.querySelector('img[alt="shelf.jpg"]') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('blob:shelf');
  });

  it("sizes the pictures in a 20 × 14 rem box times pictureScale", () => {
    const { fixture, element } = render([question]);
    expect(element.style.getPropertyValue('--neat-picture-scale')).toBe('1');
    fixture.componentInstance.pictureScale.set(1.5);
    fixture.detectChanges();
    expect(element.style.getPropertyValue('--neat-picture-scale')).toBe('1.5');
    const picture = transcriptStyles.match(/\n\.picture \{([^}]*)\}/)?.[1] ?? '';
    expect(picture).toMatch(/max-width: min\(\s*calc\(20rem \* var\(--neat-picture-scale, 1\)\),/);
    expect(picture).toMatch(/max-height: calc\(14rem \* var\(--neat-picture-scale, 1\)\)/);
  });

  it('sizes each picture\'s frame to its picture, so a reading laid over it covers the picture alone', () => {
    // No percentage the frame's own size depends on: the cap is in the message row's units.
    const picture = transcriptStyles.match(/\n\.picture \{([^}]*)\}/)?.[1] ?? '';
    expect(picture).not.toMatch(/\d%/);
    expect(picture).toMatch(/cqw/);
    const message = transcriptStyles.match(/\n\.message \{([^}]*)\}/)?.[1] ?? '';
    expect(message).toMatch(/container-type: inline-size/);
    // Nor does a row of pictures stretch a frame to the tallest picture beside it.
    const pictures = transcriptStyles.match(/\n\.pictures \{([^}]*)\}/)?.[1] ?? '';
    expect(pictures).toMatch(/align-items: flex-start/);
  });

  it("each picture's Expand shows it over the whole window, and Close puts it back", () => {
    const { fixture, element } = render([question]);
    const frame = element.querySelector<HTMLElement>('.picture-frame')!;
    const button = frame.querySelector<HTMLButtonElement>('button.expand')!;
    expect(button.getAttribute('aria-label')).toBe('Expand shelf.jpg');
    button.click();
    fixture.detectChanges();
    expect(frame.hasAttribute('data-neat-expanded')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Close');
    button.click();
    fixture.detectChanges();
    expect(frame.hasAttribute('data-neat-expanded')).toBe(false);
  });

  it("keeps the user's text as written, not as Markdown", () => {
    const { element } = render([{ id: 'q', role: 'user', text: 'a **b**\nc' }]);
    const bubble = element.querySelector('[data-role="user"]')!;
    expect(bubble.querySelector('strong')).toBeNull();
    expect(bubble.textContent).toContain('a **b**\nc');
  });

  it("renders the assistant's text as neat-markdown, streaming while streaming", () => {
    const { element, set } = render([
      question,
      { id: 'a1', role: 'assistant', text: 'Three **jars**', state: 'streaming' },
    ]);
    const reply = element.querySelector('[data-role="assistant"] neat-markdown')!;
    expect(reply.querySelector('strong')?.textContent).toBe('jars');
    expect(reply.hasAttribute('data-streaming')).toBe(true);
    set([question, { id: 'a1', role: 'assistant', text: 'Three **jars**', state: 'done' }]);
    expect(reply.hasAttribute('data-streaming')).toBe(false);
  });

  it('shows the orb and clock while a reply waits, and the hidden "Waiting for the reply"', () => {
    const { element, set } = render([
      question,
      { id: 'a1', role: 'assistant', text: '', state: 'waiting' },
    ]);
    const reply = element.querySelector('[data-role="assistant"]')!;
    expect(reply.querySelector('neat-markdown')).toBeNull();
    expect(reply.querySelector('neat-chat-orb')?.getAttribute('aria-hidden')).toBe('true');
    expect(reply.querySelector('.sr-only')?.textContent).toBe('Waiting for the reply');
    set([question, { id: 'a1', role: 'assistant', text: 'Three', state: 'streaming' }]);
    expect(reply.querySelector('neat-chat-orb')).toBeNull();
  });

  describe('text motion', () => {
    const waiting: NeatChatMessage = { id: 'a1', role: 'assistant', text: '', state: 'waiting' };
    const streaming = (text: string): NeatChatMessage => ({
      id: 'a1',
      role: 'assistant',
      text,
      state: 'streaming',
    });
    const markdown = (element: HTMLElement) =>
      element.querySelector('[data-role="assistant"] neat-markdown') as HTMLElement;

    it('forwards textMotion to a reply seen waiting', () => {
      const { element, set } = render([question, waiting], 'focus');
      set([question, streaming('Three')]);
      expect(markdown(element).getAttribute('data-motion')).toBe('focus');
      expect(markdown(element).querySelector('span.piece')?.textContent).toBe('Three');
    });

    it('a reply first seen streaming shows plain, then moves from its next piece', () => {
      const { element, set } = render([question, streaming('Three jars')], 'focus');
      expect(markdown(element).hasAttribute('data-motion')).toBe(false);
      expect(markdown(element).querySelector('span.piece')).toBeNull();
      set([question, streaming('Three jars of')]);
      expect(markdown(element).getAttribute('data-motion')).toBe('focus');
      const pieces = [...markdown(element).querySelectorAll('span.piece')];
      expect(pieces.map((piece) => piece.textContent)).toEqual([' of']);
    });

    it('textMotion changed mid-reply reaches the reply', () => {
      const { element, set, fixture } = render([question, waiting], 'focus');
      set([question, streaming('Three')]);
      fixture.componentInstance.textMotion.set('token-flash');
      set([question, streaming('Three jars')]);
      expect(markdown(element).getAttribute('data-motion')).toBe('token-flash');
      const pieces = [...markdown(element).querySelectorAll('span.piece')];
      expect(pieces.map((piece) => piece.textContent)).toEqual([' jars']);
    });

    it('keeps the motion once the reply is done', () => {
      const { element, set } = render([question, waiting], 'focus');
      set([question, streaming('Three')]);
      set([question, { ...streaming('Three'), state: 'done' }]);
      set([
        question,
        { ...streaming('Three'), state: 'done' },
        { id: 'q2', role: 'user', text: 'More?' },
      ]);
      expect(markdown(element).getAttribute('data-motion')).toBe('focus');
    });

    it('forwards cloudWords', () => {
      const { element, set, fixture } = render([question, waiting], 'word-cloud');
      fixture.componentInstance.cloudWords.set(5);
      set([question, streaming('Three')]);
      expect(markdown(element).querySelectorAll('.cloud-word')).toHaveLength(5);
    });
  });

  describe('picture motion', () => {
    const waiting: NeatChatMessage = { id: 'a1', role: 'assistant', text: '', state: 'waiting' };
    const readings = (fixture: ReturnType<typeof render>['fixture']) =>
      fixture.debugElement
        .queryAll(By.directive(PictureReading))
        .map((reading) => reading.componentInstance as PictureReading);

    afterEach(() => vi.unstubAllGlobals());

    it("reads a question's pictures while its reply waits, and stops on the first word", () => {
      const { fixture, element, set } = render([question]);
      expect(readings(fixture)).toHaveLength(0);
      set([question, waiting]);
      const [reading] = readings(fixture);
      expect(reading).toBeDefined();
      expect(reading.motion()).toBe('coming-into-focus');
      expect(reading.src()).toBe('blob:shelf');
      expect(reading.answered()).toBe(false);
      // It sits over the picture, in the picture's frame.
      const frame = element.querySelector('[data-role="user"] .picture-frame')!;
      expect(frame.querySelector('img.picture')).not.toBeNull();
      expect(frame.querySelector('neat-chat-picture-reading')).not.toBeNull();
      // Its patches fly to the reply's orb.
      expect(reading.target()()).toBe(element.querySelector('[data-role="assistant"] .orb'));
      set([question, { ...waiting, text: 'Three', state: 'streaming' }]);
      expect(readings(fixture)[0].answered()).toBe(true);
      reading.done.emit();
      fixture.detectChanges();
      expect(readings(fixture)).toHaveLength(0);
      expect(frame.querySelector('img.picture')).not.toBeNull();
    });

    it('a new reading of the same question replaces the old one', () => {
      const { fixture, set } = render([question]);
      set([question, waiting]);
      const [first] = readings(fixture);
      set([question, { ...waiting, state: 'error', error: 'Lost' }]);
      fixture.componentInstance.pictureMotion.set('viewfinder');
      set([question, { ...waiting, id: 'a2' }]);
      const [second] = readings(fixture);
      expect(second).not.toBe(first);
      expect(second.motion()).toBe('viewfinder');
      expect(second.answered()).toBe(false);
    });

    it('pictureFlight sends a reading\'s patches into the orb, from the next reading on', () => {
      const { fixture, set } = render([question]);
      set([question, waiting]);
      expect(readings(fixture)[0].flight()).toBe(false);
      fixture.componentInstance.pictureFlight.set(true);
      set([question, { ...waiting, id: 'a2' }]);
      expect(readings(fixture)[0].flight()).toBe(true);
    });

    it('finishes the reading when its waiting reply goes', () => {
      const { fixture, set } = render([question]);
      set([question, waiting]);
      expect(readings(fixture)[0].answered()).toBe(false);
      set([question]);
      expect(readings(fixture)[0].answered()).toBe(true);
    });

    it('a picture under its reading stays in the accessibility tree', () => {
      const rule =
        transcriptStyles.match(
          /neat-chat-picture-reading\[data-motion='coming-into-focus'\][^{]*\{([^}]*)\}/,
        )?.[1] ?? '';
      expect(rule).toMatch(/opacity:\s*0/);
      expect(rule).not.toMatch(/visibility:\s*hidden|display:\s*none/);
    });

    it('drops the reading when its question goes', () => {
      const { fixture, set } = render([question]);
      set([question, waiting]);
      expect(readings(fixture)).toHaveLength(1);
      set([waiting]);
      set([question, waiting]);
      expect(readings(fixture)).toHaveLength(0);
    });

    it('pictureMotion none, or reduced motion, reads nothing', () => {
      const none = render([question]);
      none.fixture.componentInstance.pictureMotion.set('none');
      none.set([question, waiting]);
      expect(readings(none.fixture)).toHaveLength(0);

      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
      const reduced = render([question]);
      reduced.set([question, waiting]);
      expect(readings(reduced.fixture)).toHaveLength(0);
    });

    it('a question without pictures has no reading', () => {
      const plain: NeatChatMessage = { id: 'q1', role: 'user', text: 'Hello?' };
      const { fixture, set } = render([plain]);
      set([plain, waiting]);
      expect(readings(fixture)).toHaveLength(0);
    });
  });

  it('says Stopped after a stopped reply', () => {
    const { element } = render([{ id: 'a1', role: 'assistant', text: 'Half a', state: 'stopped' }]);
    const reply = element.querySelector('[data-role="assistant"]')!;
    expect(reply.textContent).toContain('Half a');
    expect(reply.querySelector('.stopped')?.textContent?.trim()).toBe('Stopped');
  });

  it("shows an error in a danger callout with the app's actions", () => {
    const { element } = render([
      {
        id: 'a1',
        role: 'assistant',
        text: '',
        state: 'error',
        error: 'The conversation is too long for the model.',
      },
    ]);
    const callout = element.querySelector('[data-role="assistant"] neat-callout')!;
    expect(callout.textContent).toContain('The conversation is too long for the model.');
    expect(callout.querySelector('button.new-chat')?.textContent).toBe('New chat after a1');
  });

  it('renders the footer template under a message, given the message', () => {
    const { element } = render([question]);
    const bubble = element.querySelector('[data-message="q1"]')!;
    expect(bubble.querySelector('.footer')?.textContent).toBe('footer of q1');
  });

  it('announces a finished reply once, not while streaming', () => {
    const { element, set } = render([question]);
    const live = element.querySelector('[aria-live="polite"]')!;
    let text = '';
    for (let i = 0; i < 10; i++) {
      text += `word${i} `;
      set([question, { id: 'a1', role: 'assistant', text, state: 'streaming' }]);
      expect(live.textContent?.trim()).toBe('');
    }
    set([question, { id: 'a1', role: 'assistant', text: `${text}**done**`, state: 'done' }]);
    expect(live.textContent?.trim()).toBe(`Reply finished: ${text}done`);
    set([
      question,
      { id: 'a1', role: 'assistant', text: `${text}**done**`, state: 'done' },
      { id: 'q2', role: 'user', text: 'More?' },
    ]);
    expect(live.textContent?.trim()).toBe(`Reply finished: ${text}done`);
  });

  it('does not announce a reply that was done from the start', () => {
    const { element } = render([{ id: 'a1', role: 'assistant', text: 'Old reply' }]);
    expect(element.querySelector('[aria-live="polite"]')!.textContent?.trim()).toBe('');
  });

  it('the log is not live, and a tab stop to scroll by keys', () => {
    const { element } = render([question]);
    const log = element.querySelector('[role="log"]')!;
    expect(log.getAttribute('aria-live')).toBe('off');
    expect(log.getAttribute('aria-label')).toBe('Conversation');
    expect(log.getAttribute('tabindex')).toBe('0');
  });

  it('announces a failed reply', () => {
    const { element, set } = render([
      question,
      { id: 'a1', role: 'assistant', text: '', state: 'waiting' },
    ]);
    set([
      question,
      { id: 'a1', role: 'assistant', text: '', state: 'error', error: 'The board went away.' },
    ]);
    expect(element.querySelector('[aria-live="polite"]')!.textContent?.trim()).toBe(
      'Reply failed: The board went away.',
    );
  });

  it('Latest leaves the focus on the conversation', async () => {
    const { element, fixture } = render([question]);
    await fixture.whenStable();
    const log = scrollable(element);
    log.scrollTop = 500;
    log.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    const latest = element.querySelector('button.latest') as HTMLButtonElement;
    latest.focus();
    latest.click();
    fixture.detectChanges();
    expect(element.querySelector('button.latest')).toBeNull();
    expect(document.activeElement).toBe(log);
  });

  it('follows again when the visitor sends a question', async () => {
    const { element, fixture, set } = render([question]);
    await fixture.whenStable();
    const log = scrollable(element);
    log.scrollTop = 500;
    log.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(element.querySelector('button.latest')).not.toBeNull();
    set([question, { id: 'q2', role: 'user', text: 'And now?' }]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('button.latest')).toBeNull();
    expect(log.scrollTop).toBe(600);
  });

  describe('heard questions', () => {
    const heard: NeatChatMessage = {
      id: 'h1',
      role: 'user',
      text: 'What is on this shelf?',
      heard: true,
    };
    const typed: NeatChatMessage = { id: 't1', role: 'user', text: 'Typed question' };
    const arrivals = (fixture: { debugElement: import('@angular/core').DebugElement }) =>
      fixture.debugElement.queryAll(By.directive(HeardArrival));

    /** A transcript that rendered once, its clock stepped by the spec, in a listening motion. */
    function later(motion: NeatListeningMotion, messages: NeatChatMessage[] = []) {
      const clock = steppedFrames();
      TestBed.configureTestingModule({ providers: [{ provide: CHAT_CLOCK, useValue: clock }] });
      const t = render(messages);
      t.fixture.componentInstance.listeningMotion.set(motion);
      t.fixture.detectChanges();
      return { ...t, clock };
    }

    afterEach(() => vi.unstubAllGlobals());

    it('a heard question seen after the first render arrives in the listening motion', () => {
      for (const motion of ['radial', 'in-message-box'] as const) {
        TestBed.resetTestingModule();
        const t = later(motion);
        t.set([heard]);
        const found = arrivals(t.fixture);
        expect(found, motion).toHaveLength(1);
        expect(found[0].componentInstance.motion(), motion).toBe(motion);
        expect(t.element.querySelector('.question')!.textContent!.trim()).toBe(heard.text);
      }
    });

    it('the arrival ends at its done, and the question is plain text again', () => {
      const t = later('radial');
      t.set([heard]);
      for (let i = 0; i < 100 && arrivals(t.fixture).length; i++) {
        t.clock.frame(30);
        t.fixture.detectChanges();
      }
      expect(arrivals(t.fixture)).toHaveLength(0);
      expect(t.element.querySelector('.question')!.textContent).toBe(heard.text);
    });

    it('a restored heard question and a typed question show plain', () => {
      const restored = later('radial', [heard]);
      expect(arrivals(restored.fixture)).toHaveLength(0);
      TestBed.resetTestingModule();
      const t = later('radial');
      t.set([typed]);
      expect(arrivals(t.fixture)).toHaveLength(0);
    });

    it('reduced motion shows the heard question plain', () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
      const reduced = later('radial');
      reduced.set([heard]);
      expect(arrivals(reduced.fixture)).toHaveLength(0);
    });

    it('the arrival ends when its question goes', () => {
      const t = later('radial');
      t.set([heard]);
      expect(arrivals(t.fixture)).toHaveLength(1);
      t.set([]);
      expect(arrivals(t.fixture)).toHaveLength(0);
      expect(t.clock.pending()).toBe(false);
    });

    it("the in-message-box arrival takes the box's origin", () => {
      const t = later('in-message-box');
      const area = document.createElement('textarea');
      TestBed.inject(HeardOrigin).note(area);
      t.set([heard]);
      expect(arrivals(t.fixture)[0].componentInstance.origin()).toBe(area);
      expect(TestBed.inject(HeardOrigin).take()).toBeNull();
    });
  });

  describe('read aloud', () => {
    const speech: NeatSpeech = {
      from: 0,
      to: 12,
      startedAt: 0,
      audio: { samples: new Float32Array(1600), sampleRate: 16_000 },
    };
    const reply: NeatChatMessage = {
      id: 'r1',
      role: 'assistant',
      text: 'Three jars. Of pasta.',
      speech,
    };
    const strips = (element: HTMLElement) => element.querySelectorAll('canvas.speech-strip');

    beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null));
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('forwards speech and speakingMotion to the reply', () => {
      const t = render([question, reply]);
      t.fixture.componentInstance.speakingMotion.set('equalizer');
      t.fixture.detectChanges();
      const markdown = t.fixture.debugElement.query(By.directive(NeatMarkdown))
        .componentInstance as NeatMarkdown;
      expect(markdown.speech()).toBe(speech);
      expect(markdown.speakingMotion()).toBe('equalizer');
    });

    it('waveform shows the strip under the reply while it has speech, and not under reduced motion', () => {
      const t = render([question, reply]);
      expect(strips(t.element)).toHaveLength(0);
      t.fixture.componentInstance.speakingMotion.set('waveform');
      t.fixture.detectChanges();
      const strip = strips(t.element);
      expect(strip).toHaveLength(1);
      expect(strip[0].getAttribute('aria-hidden')).toBe('true');
      expect(strip[0].closest('[data-message]')!.getAttribute('data-message')).toBe('r1');
      TestBed.resetTestingModule();
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
      const reduced = render([question, reply]);
      reduced.fixture.componentInstance.speakingMotion.set('waveform');
      reduced.fixture.detectChanges();
      expect(strips(reduced.element)).toHaveLength(0);
    });

    it('the strip leaves with the speech and with its reply', async () => {
      const t = render([question, reply]);
      t.fixture.componentInstance.speakingMotion.set('waveform');
      t.fixture.detectChanges();
      expect(strips(t.element)).toHaveLength(1);
      t.set([question, { ...reply, speech: undefined }]);
      await t.fixture.whenStable();
      expect(strips(t.element)).toHaveLength(0);
      t.set([question, reply]);
      expect(strips(t.element)).toHaveLength(1);
      t.set([question]);
      await t.fixture.whenStable();
      expect(strips(t.element)).toHaveLength(0);
    });
  });
});
