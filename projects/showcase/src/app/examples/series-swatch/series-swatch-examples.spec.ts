import { TestBed } from '@angular/core/testing';
import { RunChips } from './1-run-chips.example';

describe('the series swatch examples', () => {
  it('give each run’s chip the colour of the series the chart draws the run in', async () => {
    const fixture = TestBed.createComponent(RunChips);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const chips = Array.from(host.querySelectorAll('ul[aria-label="Compared runs"] li'));

    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Run A', 'Run B', 'Run C']);
    expect(
      chips.map((chip) =>
        chip.querySelector<HTMLElement>('neat-series-swatch')?.style.getPropertyValue('--series'),
      ),
    ).toEqual(['var(--neat-series-1)', 'var(--neat-series-2)', 'var(--neat-series-3)']);
  });
});
