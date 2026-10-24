import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { NeatChartFormat, NeatChartTone } from './types';
import { NeatSparkline } from './sparkline';

@Component({
  imports: [NeatSparkline],
  template: `<neat-sparkline
    [values]="values()"
    label="MLA RTSN-0"
    [format]="format()"
    [tone]="tone()"
  />`,
})
class SparklineHost {
  readonly values = signal<readonly (number | null)[]>([]);
  readonly format = signal<NeatChartFormat>(String);
  readonly tone = signal<NeatChartTone>('default');
}

async function render(values: readonly (number | null)[]) {
  const fixture = TestBed.createComponent(SparklineHost);
  fixture.componentInstance.values.set(values);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  return {
    fixture,
    host: root.querySelector('neat-sparkline') as HTMLElement,
    paths: () => Array.from(root.querySelectorAll('path')),
    refresh: () => fixture.whenStable(),
  };
}

/** The `M` sub-paths of a d3 path string. */
const segments = (path: SVGPathElement): number =>
  (path.getAttribute('d')?.match(/M/g) ?? []).length;

describe('NeatSparkline', () => {
  // Ported from #170's "sparklines preserve gaps, need two points, and describe themselves".
  it('scales min to max across the index and splits the line at a missing sample', async () => {
    const { paths } = await render([70, null, 72, 74]);
    expect(paths()).toHaveLength(1);
    expect(paths()[0].getAttribute('d')).toBe('M400,50L600,0');
  });

  it('describes itself: the label, how many samples, the lowest and the highest', async () => {
    const { host, fixture } = await render([70, null, 72]);
    fixture.componentInstance.format.set((value) => `${value} °C`);
    await fixture.whenStable();
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('MLA RTSN-0: 2 recent samples, 70 °C to 72 °C');
  });

  it('a sparkline with one number draws nothing and still says it has no recent samples', async () => {
    for (const values of [[70], [null, 70, null], [null, null], []]) {
      const { host, paths } = await render(values);
      expect(paths(), JSON.stringify(values)).toEqual([]);
      expect(host.getAttribute('aria-label')).toBe('MLA RTSN-0: no recent samples');
      expect(host.querySelector('svg'), 'keeps its box').not.toBeNull();
    }
  });

  it('draws a flat run across the middle of its box', async () => {
    const { paths } = await render([5, 5]);
    expect(paths()[0].getAttribute('d')).toBe('M0,50L600,50');
    expect(segments(paths()[0])).toBe(1);
  });

  it('takes its stroke from the tone', async () => {
    const { host, fixture } = await render([1, 2]);
    const stroke = () => host.style.getPropertyValue('--sparkline-stroke');
    expect(stroke()).toBe('var(--neat-line)');
    fixture.componentInstance.tone.set('warning');
    await fixture.whenStable();
    expect(stroke()).toBe('var(--neat-line-warning)');
    fixture.componentInstance.tone.set('danger');
    await fixture.whenStable();
    expect(stroke()).toBe('var(--neat-line-danger)');
  });
});
