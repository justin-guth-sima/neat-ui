import { TestBed } from '@angular/core/testing';
import { KeysOfAnApp } from './1-keys-of-an-app.example';
import { InAButton } from './2-in-a-button.example';

const keysOf = (shortcut: Element) =>
  Array.from(shortcut.querySelectorAll('kbd'), (kbd) => kbd.textContent?.trim());

describe('the shortcut examples', () => {
  beforeEach(() => vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Linux x86_64'));
  afterEach(() => vi.restoreAllMocks());

  it('list each action beside its keys', async () => {
    const fixture = TestBed.createComponent(KeysOfAnApp);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const labels = Array.from(host.querySelectorAll('dt'), (dt) => dt.textContent?.trim());
    const keys = Array.from(host.querySelectorAll('neat-shortcut'), keysOf);

    expect(labels).toEqual(['Search', 'Redo', 'Move up', 'Close']);
    expect(keys).toEqual([['Ctrl', 'K'], ['Ctrl', 'Shift', 'Z'], ['↑'], ['Esc']]);
  });

  it('run on a click and on Ctrl or ⌘ Enter, with the shortcut hidden in the named button', async () => {
    const fixture = TestBed.createComponent(InAButton);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector('button') as HTMLButtonElement;
    const note = () => host.querySelector('[neatNote]')?.textContent?.trim();

    expect(button.getAttribute('aria-keyshortcuts')).toBe('Control+Enter Meta+Enter');
    expect(button.querySelector('neat-shortcut')?.getAttribute('aria-hidden')).toBe('true');
    expect(keysOf(button.querySelector('neat-shortcut') as Element)).toEqual(['Ctrl', 'Enter']);

    button.click();
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ...modifier }));
    }
    await fixture.whenStable();

    // The click and the two plain modified presses; Shift Enter is no Mod Enter.
    expect(note()).toBe('Runs: 3');
  });
});
