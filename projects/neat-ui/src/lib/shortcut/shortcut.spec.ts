import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import proseStyles from '../prose/prose.css' with { loader: 'text' };
import shortcutStyles from './shortcut.css' with { loader: 'text' };
import { NeatShortcut } from './shortcut';

@Component({
  imports: [NeatShortcut],
  template: `<neat-shortcut [keys]="keys()" />`,
})
class ShortcutHost {
  readonly keys = signal<readonly string[]>(['Mod', 'K']);
}

async function render(keys: readonly string[], platform = 'Linux x86_64') {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
  const fixture = TestBed.createComponent(ShortcutHost);
  fixture.componentInstance.keys.set(keys);
  await fixture.whenStable();
  const host = (fixture.nativeElement as HTMLElement).querySelector('neat-shortcut') as HTMLElement;
  return {
    fixture,
    shown: () => Array.from(host.querySelectorAll('kbd'), (kbd) => kbd.textContent?.trim()),
    spoken: () => host.querySelector('.sr-only')?.textContent?.trim(),
    host,
  };
}

describe('NeatShortcut', () => {
  afterEach(() => vi.restoreAllMocks());

  it('draws each key as a kbd, Mod as Ctrl and said as Control off a Mac', async () => {
    const { shown, spoken } = await render(['Mod', 'K']);

    expect(shown()).toEqual(['Ctrl', 'K']);
    expect(spoken()).toBe('Control K');
  });

  it('shows a Mac its symbols and says them in words', async () => {
    const { shown, spoken } = await render(['Mod', 'Alt', 'Shift', 'Control', 'P'], 'MacIntel');

    expect(shown()).toEqual(['⌘', '⌥', '⇧', '⌃', 'P']);
    expect(spoken()).toBe('Command Option Shift Control P');
  });

  it('takes an iPhone or an iPad for a Mac, as the search palette did', async () => {
    expect((await render(['Mod'], 'iPad')).shown()).toEqual(['⌘']);
    vi.restoreAllMocks();
    expect((await render(['Mod'], 'iPhone')).shown()).toEqual(['⌘']);
  });

  it('shortens Escape and draws the arrows, said in words', async () => {
    const { shown, spoken } = await render([
      'Escape',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ]);

    expect(shown()).toEqual(['Esc', '↑', '↓', '←', '→']);
    expect(spoken()).toBe('Escape Up arrow Down arrow Left arrow Right arrow');
  });

  it('puts a single letter in capitals and shows any other name as it is written', async () => {
    const { shown, spoken } = await render(['Shift', 'k', 'F1', '/', 'Enter', 'constructor']);

    expect(shown()).toEqual(['Shift', 'K', 'F1', '/', 'Enter', 'constructor']);
    expect(spoken()).toBe('Shift K F1 / Enter constructor');
  });

  it('hides the keys from assistive technology and says them in visually hidden words', async () => {
    const { host } = await render(['Mod', 'K']);

    for (const kbd of Array.from(host.querySelectorAll('kbd'))) {
      expect(kbd.getAttribute('aria-hidden')).toBe('true');
    }
    expect(host.querySelector('.sr-only')?.getAttribute('aria-hidden')).toBeNull();
  });

  it('follows its keys when they change', async () => {
    const { fixture, shown } = await render(['Mod', 'K']);
    fixture.componentInstance.keys.set(['Escape']);
    await fixture.whenStable();

    expect(shown()).toEqual(['Esc']);
  });

  it('is the containing block of its hidden words', () => {
    expect(shortcutStyles).toMatch(/:host\s*\{[^}]*position:\s*relative/);
    expect(shortcutStyles).not.toMatch(/z-index/);
  });

  it('draws each key in the kit’s one key look, which prose shares, in the theme tokens', async () => {
    const { host } = await render(['Mod', 'K']);

    for (const kbd of host.querySelectorAll('kbd')) expect(kbd.classList).toContain('neat-key');
    const key = /@utility neat-key\s*\{([^}]*)\}/.exec(proseStyles)?.[1] ?? '';
    expect(key).toMatch(/border:\s*1px solid var\(--border\)/);
    expect(key).toMatch(/background:\s*var\(--muted\)/);
  });
});
