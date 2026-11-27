import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { steppedFrames } from './chat.testing';
import { CHAT_CLOCK } from './chat-clock';
import { HeardArrival, HEARD_GLYPHS } from './heard';
import heardStyles from './heard.css' with { loader: 'text' };

@Component({
  imports: [HeardArrival],
  template: `<p class="question">
    <neat-chat-heard [text]="text()" (done)="dones = dones + 1" />
  </p>`,
})
class Host {
  readonly text = signal('What is on this shelf?');
  dones = 0;
}

function render(text = 'What is on this shelf?') {
  const clock = steppedFrames();
  TestBed.configureTestingModule({ providers: [{ provide: CHAT_CLOCK, useValue: clock }] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.text.set(text);
  fixture.detectChanges();
  const element = fixture.nativeElement.querySelector('neat-chat-heard') as HTMLElement;
  const letters = () => [...element.querySelectorAll<HTMLElement>('span.c')];
  return { clock, fixture, element, letters, host: fixture.componentInstance };
}

describe('HeardArrival', () => {
  it('deciphers two more letters every 30 ms with ten glyphs after them', () => {
    const t = render();
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
    const t = render('abcdefghijklmnopqrstuvwxyz');
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
    const t = render();
    expect(t.element.textContent).toBe('What is on this shelf?');
    t.clock.frame(64);
    expect(t.element.textContent).toBe('What is on this shelf?');
    for (const letter of t.letters()) expect(letter.getAttribute('aria-hidden')).toBeNull();
  });

  it('deciphers Japanese text letter by letter too', () => {
    const text = '棚の上に何がありますか';
    const t = render(text);
    expect(t.letters()).toHaveLength([...text].length);
    expect(t.element.textContent).toBe(text);
  });

  it('deciphers letters that come when the text changes while it arrives', () => {
    const t = render('abcd');
    t.clock.frame(31);
    t.host.text.set('abcdefghijklmnopqrstuvwxyz');
    t.fixture.detectChanges();
    for (let i = 0; i < 40 && t.host.dones === 0; i++) t.clock.frame(30);
    expect(t.letters()).toHaveLength(26);
    expect(t.letters().every((letter) => letter.hasAttribute('data-shown'))).toBe(true);
    expect(t.host.dones).toBe(1);
  });

  it('emits done once every letter is shown, and runs no frames after', () => {
    const t = render();
    for (let i = 0; i < 100 && t.host.dones === 0; i++) t.clock.frame(30);
    expect(t.host.dones).toBe(1);
    expect(t.letters().every((letter) => letter.hasAttribute('data-shown'))).toBe(true);
    expect(t.clock.pending()).toBe(false);
  });
});
