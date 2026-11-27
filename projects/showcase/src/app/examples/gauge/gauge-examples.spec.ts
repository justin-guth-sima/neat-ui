import { TestBed } from '@angular/core/testing';
import { ReplySpeed } from './1-reply-speed.example';
import { WithZones } from './2-with-zones.example';
import { REPLY_SPEEDS } from './data';

describe('the gauge examples', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the reply speed in a chart card and takes a new reading each second', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const fixture = TestBed.createComponent(ReplySpeed);
    await fixture.whenStable();
    const gauge: HTMLElement = fixture.nativeElement.querySelector('neat-chart-card neat-gauge');

    expect(gauge.getAttribute('aria-valuetext')).toBe(`${REPLY_SPEEDS[0]} tokens/s of 60`);
    vi.advanceTimersByTime(1000);
    await fixture.whenStable();
    expect(gauge.getAttribute('aria-valuenow')).toBe(String(REPLY_SPEEDS[1]));
    fixture.destroy();
  });

  it('shows three temperatures, below the zones, in warning and in danger', async () => {
    const fixture = TestBed.createComponent(WithZones);
    await fixture.whenStable();
    const gauges = [...(fixture.nativeElement as HTMLElement).querySelectorAll('neat-gauge')];

    expect(gauges.map((gauge) => gauge.getAttribute('aria-valuetext'))).toEqual([
      '62 °C of 110',
      '91 °C of 110, warning',
      '104 °C of 110, danger',
    ]);
    expect(gauges.map((gauge) => gauge.querySelector('.label')?.textContent?.trim())).toEqual([
      'A65 temperature',
      'EV74 temperature',
      'MLA temperature',
    ]);
  });
});
