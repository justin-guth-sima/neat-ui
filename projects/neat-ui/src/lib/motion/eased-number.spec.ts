import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatEasedNumber } from './eased-number';

@Component({
  imports: [NeatEasedNumber],
  template: `<neat-eased-number [value]="value()" [digits]="digits()" />`,
})
class EasedHost {
  readonly value = signal<number | null | undefined>(undefined);
  readonly digits = signal(0);
}

@Component({
  imports: [NeatEasedNumber],
  template: `<neat-eased-number [value]="value()" [easing]="'linear'" />`,
})
class LinearHost {
  readonly value = signal<number | null | undefined>(0);
}

async function render(value: number | null | undefined, digits = 0) {
  const fixture = TestBed.createComponent(EasedHost);
  fixture.componentInstance.value.set(value);
  fixture.componentInstance.digits.set(digits);
  await fixture.whenStable();
  const element = (fixture.nativeElement as HTMLElement).querySelector(
    'neat-eased-number',
  ) as HTMLElement;
  return { fixture, host: fixture.componentInstance, element };
}

describe('NeatEasedNumber', () => {
  it('shows a dash while there is no value', async () => {
    const { fixture, host, element } = await render(undefined);

    expect(element.textContent?.trim()).toBe('–');
    host.value.set(4);
    await fixture.whenStable();
    host.value.set(null);
    await fixture.whenStable();
    expect(element.textContent?.trim()).toBe('–');
  });

  it('shows its first value at once, with no digits after the point by default', async () => {
    const { element } = await render(12.6);

    expect(element.textContent?.trim()).toBe('13');
  });

  it('shows as many digits after the point as it is given', async () => {
    const { fixture, host, element } = await render(3.14159, 2);

    expect(element.textContent?.trim()).toBe('3.14');
    host.digits.set(1);
    await fixture.whenStable();
    expect(element.textContent?.trim()).toBe('3.1');
  });

  it('sets its figures in tabular digits, so a moving value does not shake', async () => {
    const { element } = await render(1);

    expect(element.classList).toContain('tabular-nums');
  });

  it('moves by the curve it is given', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      const fixture = TestBed.createComponent(LinearHost);
      await fixture.whenStable();
      fixture.componentInstance.value.set(100);
      await fixture.whenStable();

      await vi.advanceTimersByTimeAsync(100);
      fixture.detectChanges();
      // Frames land every 16 ms, so "a quarter" is 24; the default curve would show 6 here.
      expect(Number((fixture.nativeElement as HTMLElement).textContent?.trim())).toBe(24);
    } finally {
      vi.useRealTimers();
    }
  });
});
