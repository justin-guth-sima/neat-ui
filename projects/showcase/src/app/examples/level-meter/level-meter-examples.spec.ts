import { TestBed } from '@angular/core/testing';
import { SineWave } from './1-sine-wave.example';

const lit = (host: HTMLElement): number =>
  host.querySelectorAll('[data-slot="level-meter-segment"]:not(.bg-border)').length;

describe('the level meter example', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('light segments while it runs and go dark when it is stopped', async () => {
    const fixture = TestBed.createComponent(SineWave);
    const host = fixture.nativeElement as HTMLElement;
    const toggle = host.querySelector('button')!;
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(1000);

    expect(toggle.textContent?.trim()).toBe('Stop');
    expect(lit(host)).toBeGreaterThan(0);
    expect(host.querySelector('neat-level-meter')?.getAttribute('aria-hidden')).toBe('true');

    toggle.click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(100);

    expect(toggle.textContent?.trim()).toBe('Start');
    expect(lit(host)).toBe(0);
  });
});
