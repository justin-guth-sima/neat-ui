import { TestBed } from '@angular/core/testing';
import { EasedNumber } from './1-eased-number.example';
import { EasedSignal } from './2-eased-signal.example';
import { Curves } from './3-curves.example';

const button = (host: HTMLElement, name: string): HTMLButtonElement =>
  Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;

/** The easing runs on animation frames, which fake timers step by hand. */
async function settle(fixture: { detectChanges(): void }, ms: number): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  fixture.detectChanges();
}

describe('the motion examples', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('show the first value at once, ease to the next, and show a dash for none', async () => {
    const fixture = TestBed.createComponent(EasedNumber);
    const host = fixture.nativeElement as HTMLElement;
    const figure = () => host.querySelector('neat-eased-number')!.textContent?.trim();
    await settle(fixture, 0);

    expect(figure()).toBe('24.0');

    button(host, 'Next value').click();
    await settle(fixture, 200);
    const midway = Number(figure());
    expect(midway).toBeGreaterThan(24);
    expect(midway).toBeLessThan(29.9);

    await settle(fixture, 300);
    expect(figure()).toBe('29.9');

    button(host, 'No value').click();
    await settle(fixture, 0);
    expect(figure()).toBe('–');
  });

  it('ease the value of the bar to each share', async () => {
    const fixture = TestBed.createComponent(EasedSignal);
    const host = fixture.nativeElement as HTMLElement;
    const value = () =>
      Number(
        host
          .querySelector('[role="progressbar"][aria-label="Share"]')!
          .getAttribute('aria-valuenow'),
      );
    await settle(fixture, 0);

    expect(value()).toBe(20);

    button(host, 'Next share').click();
    await settle(fixture, 200);
    expect(value()).toBeGreaterThan(20);
    expect(value()).toBeLessThan(85);

    await settle(fixture, 300);
    expect(value()).toBe(85);
  });

  it('move four bars, one per curve, with one press', async () => {
    const fixture = TestBed.createComponent(Curves);
    const host = fixture.nativeElement as HTMLElement;
    const now = () =>
      Array.from(host.querySelectorAll('[role="progressbar"]')).map((bar) =>
        Number(bar.getAttribute('aria-valuenow')),
      );
    await settle(fixture, 0);

    expect(now()).toEqual([0, 0, 0, 0]);

    button(host, 'Next share').click();
    await settle(fixture, 100);
    const early = now();
    expect(early).toHaveLength(4);
    expect(early.every((v) => v > 0 && v < 100)).toBe(true);
    expect(new Set(early).size).toBe(4);

    await settle(fixture, 400);
    expect(now()).toEqual([100, 100, 100, 100]);
  });
});
