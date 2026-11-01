import { TestBed } from '@angular/core/testing';
import { LostConnection } from './1-lost-connection.example';

describe('the stale example', () => {
  it('fade the readout while stale, say why, and show it as it is once fresh', async () => {
    const fixture = TestBed.createComponent(LostConnection);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const readout = host.querySelector('span')!;
    const toggle = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Stale',
    )!;

    expect(readout.className).toContain('grayscale');
    expect(host.textContent).toContain('Connection lost');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    toggle.click();
    await fixture.whenStable();

    expect(readout.className).not.toContain('grayscale');
    expect(host.textContent).not.toContain('Connection lost');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });
});
