import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type NeatScore, NeatScoreBars } from './score-bars';

@Component({
  imports: [NeatScoreBars],
  template: `<neat-score-bars
    label="Gesture probabilities"
    [scores]="scores()"
    [labels]="labels()"
    [quiet]="quiet()"
  />`,
})
class ScoreBarsHost {
  readonly scores = signal<readonly NeatScore[]>([]);
  readonly labels = signal<readonly string[]>([]);
  readonly quiet = signal<readonly string[]>([]);
}

async function render(values: readonly number[], labels: readonly string[] = []) {
  const fixture = TestBed.createComponent(ScoreBarsHost);
  fixture.componentInstance.scores.set(
    values.map((value, index) => ({ label: `Row ${index}`, value })),
  );
  fixture.componentInstance.labels.set(labels);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host,
    rows: Array.from<HTMLElement>(host.querySelectorAll('[data-slot="score-bars-row"]')),
  };
}

describe('NeatScoreBars', () => {
  it('draws one row per score in input order', async () => {
    const { rows } = await render([0.2, 0.5, 0.3]);

    expect(rows.map((row) => row.querySelector('.name')?.textContent?.trim())).toEqual([
      'Row 0',
      'Row 1',
      'Row 2',
    ]);
    expect(rows.map((row) => row.querySelector('.value')?.textContent?.trim())).toEqual([
      '0.20',
      '0.50',
      '0.30',
    ]);
  });

  it('names the list', async () => {
    const { host } = await render([0.2]);

    expect(host.querySelector('neat-score-bars')?.getAttribute('aria-label')).toBe(
      'Gesture probabilities',
    );
  });

  it('highlights the top score', async () => {
    const { rows } = await render([0.1, 0.8, 0.1]);

    expect(rows.map((row) => row.hasAttribute('data-top'))).toEqual([false, true, false]);
  });

  it('highlights the first of a tie', async () => {
    const { rows } = await render([0.5, 0.5]);

    expect(rows.map((row) => row.hasAttribute('data-top'))).toEqual([true, false]);
  });

  it('highlights nothing when no score is a number', async () => {
    const { rows } = await render([Number.NaN, Number.NaN]);

    expect(rows.some((row) => row.hasAttribute('data-top'))).toBe(false);
  });

  it('clamps bars and shows a dash for a non-number', async () => {
    const { rows } = await render([1.7, -0.2, Number.NaN]);
    const fill = (row: HTMLElement) => row.querySelector<HTMLElement>('.fill')!.style.width;
    const value = (row: HTMLElement) => row.querySelector('.value')?.textContent?.trim();

    expect(rows.map(fill)).toEqual(['100%', '0%', '0%']);
    expect(rows.map(value)).toEqual(['1.00', '0.00', '–']);
  });

  it('exposes each bar as a meter named by its label', async () => {
    const { rows } = await render([1.7, 0.25, Number.NaN]);
    const meters = rows.map((row) => row.querySelector('[role="meter"]')!);

    expect(meters.map((meter) => meter.getAttribute('aria-valuenow'))).toEqual(['1', '0.25', '0']);
    // A row with no value is not a score of 0: it says so.
    expect(meters.map((meter) => meter.getAttribute('aria-valuetext'))).toEqual([
      null,
      null,
      'no value',
    ]);
    expect(meters.every((meter) => meter.getAttribute('aria-valuemin') === '0')).toBe(true);
    expect(meters.every((meter) => meter.getAttribute('aria-valuemax') === '1')).toBe(true);
    expect(meters.map((meter) => meter.getAttribute('aria-label'))).toEqual([
      'Row 0',
      'Row 1',
      'Row 2',
    ]);
  });

  it('colours each fill by the label’s place in the colour order', async () => {
    const { fixture, rows } = await render([0.4, 0.3, 0.2, 0.1], ['Row 1', 'Row 0']);
    fixture.componentInstance.quiet.set(['Row 2']);
    await fixture.whenStable();
    const colour = (row: HTMLElement) =>
      row.querySelector<HTMLElement>('.fill')!.style.getPropertyValue('--fill');

    expect(rows.map(colour)).toEqual([
      'var(--neat-series-2)',
      'var(--neat-series-1)',
      'var(--muted-foreground)',
      'var(--neat-chip-neutral)',
    ]);
  });

  it('counts a repeated label once when it orders colours by first appearance', async () => {
    const fixture = TestBed.createComponent(ScoreBarsHost);
    fixture.componentInstance.scores.set([
      { label: 'A', value: 0.5 },
      { label: 'A', value: 0.3 },
      { label: 'B', value: 0.2 },
    ]);
    await fixture.whenStable();
    const fills = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.fill'));

    expect(fills.map((fill) => fill.style.getPropertyValue('--fill'))).toEqual([
      'var(--neat-series-1)',
      'var(--neat-series-1)',
      'var(--neat-series-2)',
    ]);
  });

  it('colours by the order of the scores when no colour order is given', async () => {
    const { rows } = await render([0.4, 0.3]);
    const colour = (row: HTMLElement) =>
      row.querySelector<HTMLElement>('.fill')!.style.getPropertyValue('--fill');

    expect(rows.map(colour)).toEqual(['var(--neat-series-1)', 'var(--neat-series-2)']);
  });
});
