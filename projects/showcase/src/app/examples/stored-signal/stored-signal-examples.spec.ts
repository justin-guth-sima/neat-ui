import { TestBed } from '@angular/core/testing';
import { PressCounter } from './1-press-counter.example';

const KEY = 'neat-ui-showcase:presses';

async function render(): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(PressCounter);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const button = (host: HTMLElement, name: string): HTMLButtonElement =>
  Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;

describe('the stored signal example', () => {
  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => localStorage.removeItem(KEY));

  it('count presses, keep the count for the next page load and reset it', async () => {
    const host = await render();
    expect(host.textContent).toContain('Pressed 0 times');

    button(host, 'Press').click();
    button(host, 'Press').click();
    expect(localStorage.getItem(KEY)).toBe('2');

    const reloaded = await render();
    expect(reloaded.textContent).toContain('Pressed 2 times');

    button(reloaded, 'Reset').click();
    expect(localStorage.getItem(KEY)).toBe('0');
  });

  it('start at 0 when what is stored is not a whole number from 0 up', async () => {
    for (const stored of ['-3', '1.5', '"many"', 'not json']) {
      localStorage.setItem(KEY, stored);

      expect((await render()).textContent, stored).toContain('Pressed 0 times');
    }
  });
});
