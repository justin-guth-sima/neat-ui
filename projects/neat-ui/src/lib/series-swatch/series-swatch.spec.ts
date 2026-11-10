import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatSeriesSwatch, seriesToken, seriesTokenName } from './series-swatch';

@Component({
  imports: [NeatSeriesSwatch],
  template: `
    @for (index of [0, 1, 2]; track index) {
      <neat-series-swatch class="chip" [index]="index" />
    }
    <neat-series-swatch class="moving" [index]="index()" />
  `,
})
class SwatchHost {
  readonly index = signal(0);
}

async function render() {
  const fixture = TestBed.createComponent(SwatchHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const all = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  const series = (selector: string) =>
    all(selector).map((element) => element.style.getPropertyValue('--swatch'));
  return { fixture, host: fixture.componentInstance, all, series };
}

describe('seriesToken', () => {
  it('counts series from 0 into the palette, which counts from 1', () => {
    expect([0, 1, 7].map(seriesToken)).toEqual([
      'var(--neat-series-1)',
      'var(--neat-series-2)',
      'var(--neat-series-8)',
    ]);
  });

  it('wraps the custom property seriesTokenName names, which canvas code resolves itself', () => {
    expect([0, 7].map(seriesTokenName)).toEqual(['--neat-series-1', '--neat-series-8']);
  });
});

describe('NeatSeriesSwatch', () => {
  it('takes the palette colour of its series index, counted from 0, through the one rule', async () => {
    const { fixture, host, series } = await render();

    expect(series('neat-series-swatch.chip')).toEqual([0, 1, 2].map(seriesToken));

    host.index.set(7);
    await fixture.whenStable();
    expect(series('neat-series-swatch.moving')).toEqual(['var(--neat-series-8)']);
  });

  it('is hidden from assistive technology: the label beside it names the series', async () => {
    const { all } = await render();

    for (const swatch of all('neat-series-swatch')) {
      expect(swatch.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
