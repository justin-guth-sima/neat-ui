import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatMarkdown } from './markdown';
import markdownStyles from './markdown.css' with { loader: 'text' };
import { NEAT_CLOUD_BOX, type NeatCloudBox } from './motion/cloud-box';
import { MOTION_CLOCK } from './motion/motion-clock';
import { steppedFrames } from './motion/motion.testing';
import { NEAT_TEXT_MOTIONS, type NeatTextMotion } from './motion/text-motions';
import {
  NEAT_SPEAKING_MOTIONS,
  type NeatSpeakingMotion,
  type NeatSpeech,
} from './speech/speaking-motions';
import { installHighlights, litText } from './speech/speech.testing';

@Component({
  imports: [NeatMarkdown],
  template: `<neat-markdown
    [text]="text()"
    [streaming]="streaming()"
    [headingOffset]="headingOffset()"
    [motion]="motion()"
    [cloudWords]="cloudWords()"
    [cloudBox]="cloudBox()"
  />`,
})
class Host {
  readonly text = signal('');
  readonly streaming = signal(false);
  readonly headingOffset = signal(2);
  readonly motion = signal<NeatTextMotion>('plain');
  readonly cloudWords = signal(12);
  readonly cloudBox = signal<NeatCloudBox>(NEAT_CLOUD_BOX);
}

function render(text: string, options: { streaming?: boolean; headingOffset?: number } = {}) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.text.set(text);
  fixture.componentInstance.streaming.set(options.streaming ?? false);
  if (options.headingOffset !== undefined) {
    fixture.componentInstance.headingOffset.set(options.headingOffset);
  }
  fixture.detectChanges();
  const element = fixture.nativeElement.querySelector('neat-markdown') as HTMLElement;
  return { fixture, element };
}

describe('NeatMarkdown', () => {
  it('marks the host while streaming, for its caret', () => {
    const { fixture, element } = render('Some text', { streaming: true });
    expect(element.hasAttribute('data-streaming')).toBe(true);
    fixture.componentInstance.streaming.set(false);
    fixture.detectChanges();
    expect(element.hasAttribute('data-streaming')).toBe(false);
  });

  it('is prose', () => {
    expect(render('Hello').element.classList).toContain('neat-prose');
  });

  it('renders headings, lists, quotes and rules as elements', () => {
    const { element } = render(
      '# Title\n\nA *b* **c** ~~d~~ `e`\n\n- one\n- two\n  1. nested\n\n> quoted\n\n---\n\n3. three',
    );
    expect(element.querySelector('h3')?.textContent).toBe('Title');
    const paragraph = element.querySelector(':scope > p')!;
    expect(paragraph.querySelector('em')?.textContent).toBe('b');
    expect(paragraph.querySelector('strong')?.textContent).toBe('c');
    expect(paragraph.querySelector('del')?.textContent).toBe('d');
    expect(paragraph.querySelector('code')?.textContent).toBe('e');
    const items = element.querySelectorAll(':scope > ul > li');
    expect(items).toHaveLength(2);
    expect(items[1].querySelector(':scope > ol > li')?.textContent).toBe('nested');
    expect(element.querySelector(':scope > blockquote > p')?.textContent).toBe('quoted');
    expect(element.querySelector(':scope > hr')).not.toBeNull();
    expect(element.querySelector(':scope > ol')?.getAttribute('start')).toBe('3');
  });

  it('shows task items with their state in words a reader sees', () => {
    const { element } = render('- [x] done\n- [ ] todo');
    const items = [...element.querySelectorAll('li')].map((li) => li.textContent?.trim());
    expect(items).toEqual(['☑ done', '☐ todo']);
  });

  it('renders fenced code as neat-code-block with its language', () => {
    const { element } = render('```python\nprint(1)\n```\n\n```\nplain\n```');
    const blocks = element.querySelectorAll(':scope > neat-code-block');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].textContent).toContain('print(1)');
    expect(blocks[1].textContent).toContain('plain');
  });

  it('renders a table with neatTable', () => {
    const { element } = render('| a | b |\n|---|--:|\n| 1 | **2** |');
    const table = element.querySelector(':scope > table')!;
    expect(table.getAttribute('neattable')).not.toBeNull();
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['a', 'b']);
    const cells = table.querySelectorAll('tbody td');
    expect(cells[1].querySelector('strong')?.textContent).toBe('2');
    expect(cells[1].getAttribute('data-numeric')).not.toBeNull();
  });

  it('renders raw HTML as text', () => {
    const { element } = render(
      '<img src=x onerror=alert(1)> and <b>x</b>\n\n<script>alert(1)</script>',
    );
    expect(element.querySelector('img, script, b')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(element.textContent).toContain('<script>alert(1)</script>');
  });

  it('links only http and https', () => {
    const { element } = render(
      '[a](javascript:alert(1)) [b](https://sima.ai) [c](data:text/html,x) [d](/relative)',
    );
    const links = [...element.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://sima.ai/']);
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toContain('noopener');
    expect(element.textContent).toContain('a');
    expect(element.textContent).toContain('d');
  });

  it('shows an image as its alt text', () => {
    const { element } = render('See ![a shelf](http://example.com/shelf.png).');
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain('[a shelf]');
  });

  it('while streaming, an unclosed bold already renders bold', () => {
    const { element } = render('Some **bo', { streaming: true });
    expect(element.querySelector('strong')?.textContent).toBe('bo');
  });

  it('while streaming, an open fence is already a code block', () => {
    const { element } = render('```js\nlet a', { streaming: true });
    expect(element.querySelector('neat-code-block')?.textContent).toContain('let a');
  });

  it("a finished block's element is kept as the text grows", () => {
    const { fixture, element } = render('First paragraph.\n\nSecond', { streaming: true });
    const first = element.querySelector('p');
    for (let i = 0; i < 20; i++) {
      fixture.componentInstance.text.update((text) => `${text} more`);
      fixture.detectChanges();
    }
    expect(element.querySelector('p')).toBe(first);
    expect(element.querySelectorAll('p')[1].textContent).toContain('more');
  });

  it('headingOffset shifts headings and caps at h6', () => {
    const { element } = render('# One\n\n#### Four', { headingOffset: 1 });
    expect(element.querySelector('h2')?.textContent).toBe('One');
    expect(element.querySelector('h5')?.textContent).toBe('Four');
    const capped = render('##### Five', { headingOffset: 3 }).element;
    expect(capped.querySelector('h6')?.textContent).toBe('Five');
  });

  it("a table's header row streams as a paragraph and becomes a table once its separator arrives", () => {
    const { fixture, element } = render('| a | b |\n', { streaming: true });
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('p')?.textContent).toContain('| a | b |');
    fixture.componentInstance.text.set('| a | b |\n|---|---|\n| 1 | 2 |');
    fixture.detectChanges();
    expect(element.querySelector('table')).not.toBeNull();
  });

  it('adds no space between runs that touch', () => {
    const { element } = render('a**b**`c`[d](https://sima.ai)e');
    expect(element.querySelector('p')?.textContent).toBe('abcde');
  });

  it('a line break is a br, and an escaped mark is its character', () => {
    const { element } = render('a  \nb \\*');
    expect(element.querySelector('p br')).not.toBeNull();
    expect(element.querySelector('p')?.textContent).toBe('ab *');
  });
});

/** A clock the spec steps by hand. */
function steppedClock() {
  let now = 0;
  return {
    now: () => now,
    request: () => 0,
    cancel: () => undefined,
    advance(ms: number) {
      now += ms;
    },
  };
}

/** `matchMedia` answering the reduced-motion query with `reduce`. */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('NeatMarkdown text motion', () => {
  let clock: ReturnType<typeof steppedClock>;

  beforeEach(() => {
    clock = steppedClock();
    stubReducedMotion(false);
    // jsdom draws nothing: a canvas without a context.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    TestBed.configureTestingModule({ providers: [{ provide: MOTION_CLOCK, useValue: clock }] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** A reply streamed write by write in `motion`. */
  function streamed(motion: NeatTextMotion, first = '') {
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    host.motion.set(motion);
    host.streaming.set(true);
    host.text.set(first);
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector('neat-markdown') as HTMLElement;
    return {
      fixture,
      element,
      write(text: string, afterMs = 20) {
        clock.advance(afterMs);
        host.text.set(text);
        fixture.detectChanges();
      },
      pieces: () => [...element.querySelectorAll<HTMLElement>('span.piece')],
    };
  }

  it('plain renders no pieces while streaming', () => {
    const reply = streamed('plain', 'Three');
    reply.write('Three jars');
    expect(reply.pieces()).toHaveLength(0);
    expect(reply.element.querySelector('p')!.childElementCount).toBe(0);
    expect(reply.element.querySelector('p')!.textContent).toBe('Three jars');
  });

  it('a streaming write with a motion renders its new characters as a piece', () => {
    const reply = streamed('focus', 'Three');
    reply.write('Three jars');
    const piece = reply.element.querySelector('span.piece[data-token="1"]')!;
    expect(piece.textContent).toBe(' jars');
    expect(piece.getAttribute('data-from')).toBe('5');
  });

  it.each(NEAT_TEXT_MOTIONS.filter((motion) => motion !== 'plain').map((motion) => [motion]))(
    "the text content is the same as plain's at every write (%s)",
    (motion) => {
      const words =
        'Three jars of **dried pasta**, a [bottle](https://sima.ai) of oil.\n\n- one\n- two and `code` here'.match(
          /\s*\S+/g,
        )!;
      const reply = streamed(motion);
      const plain = streamed('plain');
      let text = '';
      for (let i = 0; i < 30; i++) {
        text += words[i % words.length];
        reply.write(text);
        plain.write(text, 0);
        // What a reader gets: the text without what is hidden from assistive technology (noise).
        const shown = (element: HTMLElement) => {
          const copy = element.cloneNode(true) as HTMLElement;
          copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
          return copy.textContent!.replace(/\s+/g, ' ').trim();
        };
        expect(shown(reply.element)).toBe(shown(plain.element));
      }
    },
  );

  it('a piece settles into plain text after its time', () => {
    const reply = streamed('focus', 'Three');
    reply.write('Three jars');
    expect(reply.pieces()).toHaveLength(2);
    reply.write('Three jars of', 400);
    expect(reply.pieces().map((piece) => piece.textContent)).toEqual([' of']);
    expect(reply.element.querySelector('p')!.textContent).toBe('Three jars of');
  });

  it('no piece in a code block, a table or inline code', () => {
    const reply = streamed('focus', 'Intro');
    reply.write('Intro `let a` more\n\n```js\nlet b');
    reply.write('Intro `let a` more\n\n```js\nlet b = 1;\n```\n\n| a | b |\n|---|---|\n| 1 | 2');
    expect(
      reply.element.querySelector('neat-code-block span.piece, table span.piece, code span.piece'),
    ).toBeNull();
    reply.write(
      'Intro `let a` more\n\n```js\nlet b = 1;\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nAfter',
    );
    expect(reply.pieces().at(-1)!.textContent).toBe('After');
  });

  it('replacing the text mid-stream shows it whole, with no piece', () => {
    const reply = streamed('focus', 'Three jars');
    reply.write('Three jars of pasta');
    reply.write('Something else entirely, and longer than before');
    expect(reply.pieces()).toHaveLength(0);
    expect(reply.element.textContent).toContain('Something else entirely');
  });

  it('changing motion while streaming drops the old pieces', () => {
    const reply = streamed('focus', 'Three');
    reply.write('Three jars');
    reply.fixture.componentInstance.motion.set('token-flash');
    reply.fixture.detectChanges();
    expect(reply.pieces()).toHaveLength(0);
    reply.write('Three jars of');
    const pieces = reply.pieces();
    expect(pieces.map((piece) => piece.textContent)).toEqual([' of']);
    expect(pieces[0].getAttribute('data-hue')).toBe('0');
  });

  it('under reduced motion every motion renders plain', () => {
    stubReducedMotion(true);
    for (const motion of NEAT_TEXT_MOTIONS) {
      const reply = streamed(motion, 'Three');
      reply.write('Three jars');
      expect(reply.pieces(), motion).toHaveLength(0);
    }
  });

  it("drop-in groups letters into words and keeps the word's start still", () => {
    const reply = streamed('drop-in', 'pomo');
    reply.write('pomodoro', 1000);
    const piece = reply.pieces()[0];
    const word = piece.querySelector('span.word')!;
    const letters = [...word.querySelectorAll('i.letter')];
    expect(letters.map((letter) => letter.textContent).join('')).toBe('pomodoro');
    expect(letters.map((letter) => letter.hasAttribute('data-still'))).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("the host's data-motion names the motion, and none for plain", () => {
    const reply = streamed('token-flash', 'Hi');
    expect(reply.element.getAttribute('data-motion')).toBe('token-flash');
    expect(reply.element.style.getPropertyValue('--neat-motion-ms')).toBe('1400ms');
    reply.fixture.componentInstance.motion.set('plain');
    reply.fixture.detectChanges();
    expect(reply.element.hasAttribute('data-motion')).toBe(false);
  });

  it('not streaming, a motion records nothing', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.motion.set('focus');
    fixture.componentInstance.text.set('A whole reply, done.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('span.piece')).toHaveLength(0);
  });

  it('decrypt makes its engine, and none under reduced motion', () => {
    const reply = streamed('decrypt', 'Three');
    expect(reply.pieces()[0].hasAttribute('data-pending')).toBe(true);
    expect(reply.element.querySelector('span.tail')!.textContent).not.toBe('');
    stubReducedMotion(true);
    const still = streamed('decrypt', 'Three');
    expect(still.element.querySelector('[data-pending]')).toBeNull();
    expect(still.element.querySelector('span.tail')?.textContent ?? '').toBe('');
  });

  it('renders the tail at the end of the last prose block while decrypt streams', () => {
    const reply = streamed('decrypt', 'One\n\n- two\n- three');
    const tails = reply.element.querySelectorAll('span.tail');
    expect(tails).toHaveLength(1);
    expect(tails[0].closest('li')?.textContent).toContain('three');
    expect(tails[0].getAttribute('aria-hidden')).toBe('true');
    reply.fixture.componentInstance.streaming.set(false);
    reply.fixture.detectChanges();
    expect(reply.element.querySelector('span.tail')).toBeNull();
  });

  it('reverse explosion makes its engine and canvas, and neither under reduced motion', () => {
    // And lays nothing out: each element one line at the top.
    const line = { left: 0, top: 0, width: 40, height: 20, right: 40, bottom: 20 } as DOMRect;
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([line] as unknown as DOMRectList);
    const reply = streamed('reverse-explosion', 'Three');
    const canvas = reply.element.querySelector<HTMLCanvasElement>('canvas.particles')!;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    // The engine places its band on the newest line.
    expect(canvas.style.transform).toMatch(/^translateY\(/);
    stubReducedMotion(true);
    const still = streamed('reverse-explosion', 'Three');
    expect(still.element.querySelector('canvas')).toBeNull();
  });

  it('cloudWords renders that many words, clamped to 1..40', () => {
    const reply = streamed('word-cloud', 'Three');
    const words = () => reply.element.querySelectorAll('div.cloud span.cloud-word');
    expect(words()).toHaveLength(12);
    expect(reply.element.querySelector('div.cloud')!.getAttribute('aria-hidden')).toBe('true');
    expect(reply.element.querySelectorAll('div.cloud span.cloud-flight')).toHaveLength(24);
    for (const [asked, shown] of [
      [5, 5],
      [0, 1],
      [100, 40],
      [7.6, 8],
    ]) {
      reply.fixture.componentInstance.cloudWords.set(asked);
      reply.fixture.detectChanges();
      expect(words(), `${asked}`).toHaveLength(shown);
    }
  });

  it("the room under the text is the cloud box's reach below the line", () => {
    const reply = streamed('word-cloud', 'Three');
    // The default box: 26 px below the line and half of 64 px high.
    expect(reply.element.style.getPropertyValue('--neat-cloud-room')).toBe('58px');
    reply.fixture.componentInstance.cloudBox.set({ width: 'full', height: 120, x: 0, y: 40 });
    reply.fixture.detectChanges();
    expect(reply.element.style.getPropertyValue('--neat-cloud-room')).toBe('100px');
    reply.fixture.componentInstance.cloudBox.set({ width: 1, height: Number.NaN, x: 0, y: -4 });
    reply.fixture.detectChanges();
    // A height that is no number is the default's 64 px; a y below 0 is above the line.
    expect(reply.element.style.getPropertyValue('--neat-cloud-room')).toBe('28px');
  });

  it('leaving the word cloud mid-stream removes the cloud', () => {
    const reply = streamed('word-cloud', 'Three');
    reply.write('Three jars');
    expect(reply.element.querySelector('div.cloud span.cloud-word')!.textContent).not.toBe('');
    reply.fixture.componentInstance.motion.set('focus');
    reply.fixture.detectChanges();
    expect(reply.element.querySelector('div.cloud')).toBeNull();
    expect(reply.pieces()).toHaveLength(0);
    reply.write('Three jars of');
    expect(reply.pieces().map((piece) => piece.textContent)).toEqual([' of']);
  });

  it('a finished reply keeps no motion layer: it goes once its last motion ends', () => {
    const frames = steppedFrames();
    TestBed.overrideProvider(MOTION_CLOCK, { useValue: frames });
    const line = { left: 0, top: 0, width: 40, height: 20, right: 40, bottom: 20 } as DOMRect;
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([line] as unknown as DOMRectList);
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    host.motion.set('word-cloud');
    host.streaming.set(true);
    host.text.set('Three');
    fixture.detectChanges();
    frames.frame(20);
    host.text.set('Three jars');
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector('neat-markdown') as HTMLElement;
    const cloud = () => element.querySelector('div.cloud');
    expect(cloud()).not.toBeNull();
    host.streaming.set(false);
    fixture.detectChanges();
    // The cloud fades out and the flight lands before the layer goes.
    expect(cloud()).not.toBeNull();
    for (let i = 0; i < 100 && frames.pending(); i++) frames.frame();
    fixture.detectChanges();
    expect(cloud()).toBeNull();
    // A motion chosen for a finished reply makes no layer and no frames.
    const requested = frames.requested;
    host.motion.set('reverse-explosion');
    fixture.detectChanges();
    expect(element.querySelector('canvas')).toBeNull();
    expect(frames.requested).toBe(requested);
  });

  it('a decrypt piece keeps its text in the layout, unseen, for assistive technology', () => {
    const rule = markdownStyles.match(/\.piece\[data-pending\] > \.real \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).not.toMatch(/display:\s*none|visibility:\s*hidden|position:|clip-path:/);
    expect(rule).toMatch(/color:\s*transparent/);
  });

  it("decrypt's noise lies over its piece's text, clipped to it, so it lays nothing out", () => {
    const piece = markdownStyles.match(/\.piece:has\(> \.noise\) \{([^}]*)\}/)?.[1] ?? '';
    expect(piece).toMatch(/position:\s*relative/);
    const noise = markdownStyles.match(/\n\.noise \{([^}]*)\}/)?.[1] ?? '';
    expect(noise).toMatch(/position:\s*absolute/);
    expect(noise).toMatch(/overflow:\s*hidden/);
    expect(noise).toMatch(/white-space:\s*pre/);
  });

  it('decrypt cuts its pieces by word, so no piece wraps inside itself', () => {
    const reply = streamed('decrypt', 'Three');
    reply.write('Three jars of olive oil');
    const texts = reply.pieces().map((piece) => piece.querySelector('.real')!.textContent);
    expect(texts).toEqual(['Three', 'jars', 'of', 'olive', 'oil']);
  });

  it('the word cloud makes no engine under reduced motion', () => {
    stubReducedMotion(true);
    const reply = streamed('word-cloud', 'Three');
    reply.write('Three jars');
    expect(reply.element.querySelector('div.cloud')).toBeNull();
    expect(reply.pieces()).toHaveLength(0);
  });

  it('decrypt pieces hold their text and a noise hidden from assistive technology', () => {
    const reply = streamed('decrypt', 'Three');
    const piece = reply.pieces()[0];
    expect(piece.querySelector('span.real')!.textContent).toBe('Three');
    expect(piece.querySelector('span.noise')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('NeatMarkdown speech', () => {
  @Component({
    imports: [NeatMarkdown],
    template: `@if (shown()) {
      <neat-markdown
        [text]="text()"
        [streaming]="streaming()"
        [speech]="speech()"
        [speakingMotion]="speakingMotion()"
      />
    }`,
  })
  class SpeechHost {
    readonly shown = signal(true);
    readonly text = signal('');
    readonly streaming = signal(false);
    readonly speech = signal<NeatSpeech | null>(null);
    readonly speakingMotion = signal<NeatSpeakingMotion>('sentence');
  }

  let registry: ReturnType<typeof installHighlights>;
  let clock: ReturnType<typeof steppedFrames>;

  beforeEach(() => {
    registry = installHighlights();
    stubReducedMotion(false);
    clock = steppedFrames();
    TestBed.configureTestingModule({ providers: [{ provide: MOTION_CLOCK, useValue: clock }] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** A sentence of `text` said for `ms`, begun long ago: it has been said whole. */
  const sayAll = (text: string, sentence: string, ms = 1000): NeatSpeech => {
    const from = text.indexOf(sentence);
    return {
      from,
      to: from + sentence.length,
      startedAt: clock.now() - 10 * ms,
      audio: { samples: new Float32Array(ms * 16), sampleRate: 16_000 },
    };
  };

  function speaking(text: string, motion: NeatSpeakingMotion = 'equalizer', streaming = false) {
    const fixture = TestBed.createComponent(SpeechHost);
    const host = fixture.componentInstance;
    host.text.set(text);
    host.streaming.set(streaming);
    host.speakingMotion.set(motion);
    fixture.detectChanges();
    const element = () => fixture.nativeElement.querySelector('neat-markdown') as HTMLElement;
    const set = (
      changes: Partial<{ text: string; speech: NeatSpeech | null; streaming: boolean }>,
    ) => {
      if (changes.text !== undefined) host.text.set(changes.text);
      if (changes.speech !== undefined) host.speech.set(changes.speech);
      if (changes.streaming !== undefined) host.streaming.set(changes.streaming);
      fixture.detectChanges();
    };
    return {
      fixture,
      host,
      element,
      set,
      lit: (name: string) => litText(registry, `neat-speech-${name}`),
    };
  }

  it('speech keeps the same characters lit as the reply grows, a table resolves and a block before it changes', () => {
    let text = 'Intro.\n\n| a | b |\n\nThe sentence here. More';
    const t = speaking(text, 'equalizer', true);
    const speech = sayAll(text, 'The sentence here.');
    t.set({ speech });
    clock.frame(16);
    expect(t.lit('sentence')).toBe('The sentence here.');
    expect(t.lit('ahead')).toBe(' More');
    // The paragraph before it resolves into a table, and the reply grows.
    text = 'Intro.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nThe sentence here. More text';
    const moved = sayAll(text, 'The sentence here.');
    t.set({ text, speech: moved });
    clock.frame(16);
    expect(t.element().querySelector('table')).not.toBeNull();
    expect(t.lit('sentence')).toBe('The sentence here.');
    expect(t.lit('ahead')).toBe(' More text');
    // Growing without a new speech keeps the range in the source.
    t.set({ text: text + ' and more.' });
    clock.frame(16);
    expect(t.lit('sentence')).toBe('The sentence here.');
    expect(t.lit('ahead')).toBe(' More text and more.');
  });

  it('a render that only grows the text after the sentence keeps its ranges and extends what is ahead', () => {
    let text = 'The sentence here.\n\nMore';
    const t = speaking(text, 'equalizer', true);
    t.set({ speech: sayAll(text, 'The sentence here.') });
    clock.frame(16);
    const said = [...registry.get('neat-speech-sentence')!];
    expect(t.lit('ahead')).toBe('More');
    for (const piece of [' text', ' and', ' more.']) {
      text += piece;
      t.set({ text });
      clock.frame(16);
    }
    const now = [...registry.get('neat-speech-sentence')!];
    expect(now.length).toBe(said.length);
    expect(now.every((range, i) => range === said[i])).toBe(true);
    expect(t.lit('sentence')).toBe('The sentence here.');
    expect(t.lit('ahead')).toBe('More text and more.');
  });

  it('a range past the text, or inside a code block, lights nothing', () => {
    const text = 'Run:\n\n```\nprint(1)\n```\n\nDone.';
    const t = speaking(text);
    t.set({ speech: { ...sayAll(text, 'Done.'), from: 500, to: 520 } });
    for (const name of ['ahead', 'sentence', 'word', 'pending']) expect(t.lit(name)).toBe('');
    t.set({ speech: sayAll(text, 'print(1)') });
    clock.frame(16);
    for (const name of ['ahead', 'sentence', 'word', 'pending']) expect(t.lit(name)).toBe('');
  });

  it('under reduced motion every speaking motion is sentence', () => {
    stubReducedMotion(true);
    const text = 'One sentence. Another one.';
    for (const motion of NEAT_SPEAKING_MOTIONS) {
      const t = speaking(text, motion);
      t.set({ speech: sayAll(text, 'One sentence.') });
      clock.frame(16);
      expect(t.lit('ahead'), motion).toBe(' Another one.');
      expect(t.lit('sentence'), motion).toBe('One sentence.');
      expect(t.lit('word'), motion).toBe('');
      expect(t.element().querySelector('.speech-eq'), motion).toBeNull();
      t.set({ speech: null });
    }
  });

  it('the equalizer keeps its gutter with and without speech', () => {
    const text = 'One sentence. Another one.';
    const t = speaking(text, 'equalizer');
    expect(t.element().getAttribute('data-speaking-motion')).toBe('equalizer');
    expect(t.element().querySelector('.speech-eq')).toBeNull();
    t.set({ speech: sayAll(text, 'One sentence.') });
    expect(t.element().getAttribute('data-speaking-motion')).toBe('equalizer');
    expect(t.element().querySelector('.speech-eq')!.getAttribute('aria-hidden')).toBe('true');
    expect(markdownStyles).toContain("[data-speaking-motion='equalizer']");
    t.host.speakingMotion.set('sentence');
    t.fixture.detectChanges();
    expect(t.element().hasAttribute('data-speaking-motion')).toBe(false);
  });

  it('without the Highlight API nothing throws', () => {
    vi.stubGlobal('CSS', undefined);
    vi.stubGlobal('Highlight', undefined);
    const text = 'One sentence. Another one.';
    const t = speaking(text, 'equalizer');
    expect(() => {
      t.set({ speech: sayAll(text, 'One sentence.') });
      clock.frame(16);
    }).not.toThrow();
  });

  it('speech null removes the ranges and the engine', () => {
    const text = 'One sentence. Another one.';
    const t = speaking(text, 'equalizer');
    t.set({ speech: { ...sayAll(text, 'One sentence.'), startedAt: clock.now() } });
    clock.frame(100);
    expect(t.lit('ahead')).toBe(' Another one.');
    t.set({ speech: null });
    for (const name of ['ahead', 'sentence']) expect(t.lit(name)).toBe('');
    clock.frame(16);
    expect(clock.pending()).toBe(false);
    t.set({ speech: { ...sayAll(text, 'One sentence.'), startedAt: clock.now() } });
    clock.frame(100);
    t.host.shown.set(false);
    t.fixture.detectChanges();
    for (const name of ['ahead', 'sentence']) expect(t.lit(name)).toBe('');
    clock.frame(16);
    expect(clock.pending()).toBe(false);
  });
});
