import { TestBed } from '@angular/core/testing';
import { RunChips } from './1-run-chips.example';
import { AnyColour } from './2-any-colour.example';
import { SIMA_PALETTE } from '@sima/neat-ui';

describe('the series swatch examples', () => {
  it('give each run’s chip the colour of the series the chart draws the run in', async () => {
    const fixture = TestBed.createComponent(RunChips);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const chips = Array.from(host.querySelectorAll('ul[aria-label="Compared runs"] li'));

    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Run A', 'Run B', 'Run C']);
    expect(
      chips.map((chip) =>
        chip.querySelector<HTMLElement>('neat-series-swatch')?.style.getPropertyValue('--swatch'),
      ),
    ).toEqual(['var(--neat-series-1)', 'var(--neat-series-2)', 'var(--neat-series-3)']);
  });

  it('show an app’s own colours with neat-swatch', async () => {
    const fixture = TestBed.createComponent(AnyColour);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const swatches = Array.from(host.querySelectorAll<HTMLElement>('neat-swatch'));
    expect(swatches.map((swatch) => swatch.style.getPropertyValue('--swatch'))).toEqual([
      SIMA_PALETTE.blue,
      SIMA_PALETTE.orange,
      SIMA_PALETTE.green,
    ]);
  });
});
