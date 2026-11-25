import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { steppedFrames } from './chat.testing';
import { CHAT_CLOCK } from './chat-clock';
import { HeardArrival, HEARD_GLYPHS } from './heard';
import type { NeatListeningMotion } from './push-to-talk';
import heardStyles from './heard.css' with { loader: 'text' };

@Component({
  imports: [HeardArrival],
  template: `<p class="question">
    <neat-chat-heard
      [text]="text()"
      [motion]="motion()"
      [origin]="origin()"
      (done)="dones = dones + 1"
    />
  </p>`,
})
class Host {
  readonly text = signal('What is on this shelf?');
  readonly motion = signal<Exclude<NeatListeningMotion, 'level'>>('ring-and-waveform');
  readonly origin = signal<HTMLElement | null>(null);
  dones = 0;
}

function render(
  motion: Exclude<NeatListeningMotion, 'level'>,
  text = 'What is on this shelf?',
  origin: HTMLElement | null = null,
) {
  const clock = steppedFrames();
  TestBed.configureTestingModule({ providers: [{ provide: CHAT_CLOCK, useValue: clock }] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.motion.set(motion);
  fixture.componentInstance.text.set(text);
  fixture.componentInstance.origin.set(origin);
  fixture.detectChanges();
  const element = fixture.nativeElement.querySelector('neat-chat-heard') as HTMLElement;
  const letters = () => [...element.querySelectorAll<HTMLElement>('span.c')];
  const words = () => [...element.querySelectorAll<HTMLElement>('span.w')];
  return { clock, fixture, element, letters, words, host: fixture.componentInstance };
}

describe('HeardArrival', () => {
  it('ring and waveform shows two more letters every 30 ms with ten glyphs after them', () => {
    const t = render('ring-and-waveform');
    const shown = () => t.letters().filter((letter) => letter.hasAttribute('data-shown')).length;
    const glyphs = () => t.letters().filter((letter) => letter.hasAttribute('data-glyph'));
    t.clock.frame(16);
    expect(shown()).toBe(0);
    t.clock.frame(16);
    expect(shown()).toBe(2);
    // "What is on…": after "Wh" the next ten are "at is on t", three of them spaces, kept.
    expect(glyphs().map((letter) => letter.textContent)).toEqual([
      'a',
      't',
      'i',
      's',
      'o',
      'n',
      't',
    ]);
    for (const letter of glyphs()) expect(HEARD_GLYPHS).toContain(letter.dataset['glyph']);
    t.clock.frame(30);
    expect(shown()).toBe(4);
    for (let i = 0; i < 20; i++) t.clock.frame(30);
    expect(shown()).toBe(t.letters().length);
    expect(glyphs()).toHaveLength(0);
  });

  it('renews the glyphs every 60 ms, and gives a letter that comes ahead one at once', () => {
    let next = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => (next = (next + 0.137) % 1));
    const t = render('ring-and-waveform', 'abcdefghijklmnopqrstuvwxyz');
    const glyphs = () => t.letters().map((letter) => letter.dataset['glyph'] ?? '');
    t.clock.frame(31); // step 1: two shown, ten glyphs
    t.clock.frame(30); // step 2: renewed
    const renewed = glyphs();
    t.clock.frame(30); // step 3: two more shown, two new glyphs, the rest kept
    const kept = glyphs();
    expect(kept.slice(6, 14)).toEqual(renewed.slice(6, 14));
    expect(kept[14]).not.toBe('');
    expect(kept[15]).not.toBe('');
    t.clock.frame(30); // step 4: renewed
    expect(glyphs().slice(8, 16)).not.toEqual(kept.slice(8, 16));
    vi.restoreAllMocks();
  });

  it("a glyph stands within its letter's box, so wide glyphs over narrow letters do not overlap", () => {
    const rule = /\.c\[data-glyph\]::after\s*\{([^}]*)\}/.exec(heardStyles)?.[1] ?? '';
    expect(rule).toMatch(/inset-inline:\s*0/);
    expect(rule).toMatch(/overflow:\s*hidden/);
    expect(rule).toMatch(/text-align:\s*center/);
  });

  it('every letter is in the text from the start, so the bubble never changes size', () => {
    const t = render('ring-and-waveform');
    expect(t.element.textContent).toBe('What is on this shelf?');
    t.clock.frame(64);
    expect(t.element.textContent).toBe('What is on this shelf?');
    for (const letter of t.letters()) expect(letter.getAttribute('aria-hidden')).toBeNull();
  });

  it('radial gives each word its index', () => {
    const t = render('radial');
    expect(t.words().map((word) => word.textContent)).toEqual([
      'What ',
      'is ',
      'on ',
      'this ',
      'shelf?',
    ]);
    expect(t.words().map((word) => word.style.getPropertyValue('--i'))).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
    ]);
  });

  it('radial gives each word its index in Japanese text without spaces', () => {
    const text = '棚の上に何がありますか';
    const t = render('radial', text);
    const words = t.words();
    expect(words.length).toBeGreaterThan(2);
    expect(words.map((word) => word.textContent).join('')).toBe(text);
    expect(words.map((word) => word.style.getPropertyValue('--i'))).toEqual(
      words.map((_, i) => String(i)),
    );
  });

  it("in the message box starts at the origin's place and moves to its own", () => {
    const origin = document.createElement('textarea');
    origin.getBoundingClientRect = () =>
      ({ left: 40, top: 500, width: 300, height: 24 }) as DOMRect;
    const t = render('in-message-box', 'What is on this shelf?', origin);
    expect(t.words()).toHaveLength(5);
    t.element.getBoundingClientRect = () =>
      ({ left: 200, top: 100, width: 150, height: 20 }) as DOMRect;
    const transforms: string[] = [];
    Object.defineProperty(t.element.style, 'transform', {
      get: () => transforms.at(-1) ?? '',
      set: (value: string) => transforms.push(value),
    });
    t.clock.frame(16);
    // Drawn at the origin first, then let go to its own place, which the CSS transition flies to.
    expect(transforms).toEqual(['translate(-160px, 400px)', '']);
    expect(t.element.hasAttribute('data-flying')).toBe(true);
    expect(t.element.hasAttribute('data-start')).toBe(false);
  });

  it('in the message box without an origin is the radial look', () => {
    const t = render('in-message-box');
    t.clock.frame(16);
    expect(t.element.hasAttribute('data-flying')).toBe(false);
    expect(t.words()).toHaveLength(5);
  });

  it('emits done at its end and runs no frames after', () => {
    for (const motion of ['ring-and-waveform', 'radial', 'in-message-box'] as const) {
      TestBed.resetTestingModule();
      const t = render(motion);
      for (let i = 0; i < 100 && t.host.dones === 0; i++) t.clock.frame(30);
      expect(t.host.dones, motion).toBe(1);
      expect(t.clock.pending(), motion).toBe(false);
    }
  });
});
