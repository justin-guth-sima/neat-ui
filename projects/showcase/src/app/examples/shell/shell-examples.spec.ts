import { TestBed } from '@angular/core/testing';
import { KIOSK_POINTER_IDLE_MS, KioskService } from '@sima/neat-ui';
import { Kiosk } from './1-kiosk.example';

describe('the shell examples', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('enter and leave kiosk mode from one button that says which', async () => {
    const kiosk = TestBed.inject(KioskService);
    const fixture = TestBed.createComponent(Kiosk);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const [toggle] = Array.from(host.querySelectorAll('button'));
    expect(toggle.textContent?.trim()).toBe('Enter kiosk mode');

    toggle.click();
    await fixture.whenStable();

    expect(kiosk.active()).toBe(true);
    expect(toggle.textContent?.trim()).toBe('Leave kiosk mode');
    expect(host.querySelector('.showcase-code')?.textContent).toContain('active: true');

    toggle.click();
    await fixture.whenStable();

    expect(kiosk.active()).toBe(false);
  });

  it('hold the toolbar so the pointer is not idle, until the hold is released', async () => {
    vi.useFakeTimers();
    const kiosk = TestBed.inject(KioskService);
    const fixture = TestBed.createComponent(Kiosk);
    fixture.detectChanges();
    const [, hold] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    hold.click();
    fixture.detectChanges();
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS * 2);
    expect(kiosk.pointerIdle()).toBe(false);
    expect(hold.getAttribute('aria-pressed')).toBe('true');

    hold.click();
    fixture.detectChanges();
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS);
    expect(kiosk.pointerIdle()).toBe(true);
    expect(hold.getAttribute('aria-pressed')).toBe('false');
  });

  it('release a hold that is still taken when the example goes', async () => {
    vi.useFakeTimers();
    const kiosk = TestBed.inject(KioskService);
    const fixture = TestBed.createComponent(Kiosk);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelectorAll('button')[1].click();

    fixture.destroy();
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS);

    expect(kiosk.pointerIdle()).toBe(true);
  });
});
