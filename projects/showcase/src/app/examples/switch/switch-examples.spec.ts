import { TestBed } from '@angular/core/testing';
import { OnAndOff } from './1-on-and-off.example';

describe('the switch examples', () => {
  it('toggle the labelled switches, the unlabelled one sharing the first’s value', async () => {
    const fixture = TestBed.createComponent(OnAndOff);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const switches = Array.from(host.querySelectorAll<HTMLButtonElement>('button[role="switch"]'));
    const checked = () => switches.map((toggle) => toggle.getAttribute('aria-checked'));
    const status = () => host.querySelector('.showcase-code')?.textContent?.trim();

    expect(switches.map((toggle) => toggle.textContent?.trim())).toEqual([
      'Bars',
      'Hide empty',
      '',
      'Disabled',
      'Disabled, on',
    ]);
    expect(switches[2].getAttribute('aria-label')).toBe('Bars, without a visible label');
    expect(checked()).toEqual(['true', 'false', 'true', 'false', 'true']);

    switches[2].click();
    switches[1].click();
    await fixture.whenStable();

    expect(checked()).toEqual(['false', 'true', 'false', 'false', 'true']);
    expect(status()).toBe('Bars off, hide empty on');
  });

  it('leave the disabled switches as they are', async () => {
    const fixture = TestBed.createComponent(OnAndOff);
    await fixture.whenStable();
    const [off, on] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'button[role="switch"]:disabled',
      ),
    );

    off.click();
    on.click();
    await fixture.whenStable();

    expect([off, on].map((toggle) => toggle.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
    ]);
  });
});
