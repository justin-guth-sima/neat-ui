import { TestBed } from '@angular/core/testing';
import { RunMetrics } from './1-run-metrics.example';

describe('the table example', () => {
  it('name the table, end-align Mean, keep each Max figure with its status', async () => {
    const fixture = TestBed.createComponent(RunMetrics);
    await fixture.whenStable();
    const table = (fixture.nativeElement as HTMLElement).querySelector(
      'table[aria-label="Metrics of a run"]',
    )!;
    const text = (cell: Element) => cell.textContent?.replace(/\s+/g, ' ').trim();

    expect(Array.from(table.querySelectorAll('th[scope="col"]'), text)).toEqual([
      'Metric',
      'Mean',
      'Max',
    ]);
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    expect(rows.map((row) => Array.from(row.children, text))).toEqual([
      ['Board power', '7.9 W', '12.51 W OK'],
      ['SoC temperature', '61.2 °C', '84.0 °C Warm'],
      ['Memory used', '2.1 GiB', '2.4 GiB OK'],
    ]);
    expect(table.querySelectorAll('[data-numeric]')).toHaveLength(4);
    expect(table.querySelectorAll('td[data-figure]:not([data-numeric])')).toHaveLength(3);
  });
});
