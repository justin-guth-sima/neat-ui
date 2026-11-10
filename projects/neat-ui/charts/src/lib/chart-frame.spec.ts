import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import frameStyles from './chart-frame.css' with { loader: 'text' };
import { CLIPS_OR_STACKS, stylesheet } from './css.testing';
import { NeatHeatmap } from './heatmap';
import { NeatStackedChart } from './stacked-chart';
import { NeatTimeChart } from './time-chart';

const { rule, declared } = stylesheet(frameStyles);

/** The three charts that read out a sample, each with a live region for its key presses. */
@Component({
  imports: [NeatTimeChart, NeatStackedChart, NeatHeatmap],
  template: `
    <neat-time-chart
      label="MLA"
      [series]="[{ key: 'mla', label: 'MLA', values: [50, 60] }]"
      [times]="[0, 60000]"
      [domain]="[0, 100]"
    />
    <neat-stacked-chart
      label="CPU"
      [series]="[
        { key: 'a', label: 'A', values: [10, 20] },
        { key: 'b', label: 'B', values: [30, 20] },
      ]"
      [times]="[0, 60000]"
      [domain]="[0, 100]"
    />
    <neat-heatmap
      label="Cores"
      [rows]="[{ key: 'c0', label: 'Core 0', values: [10, 90], end: '50%', endTone: 'default' }]"
      [times]="[0, 60000]"
    />
  `,
})
class ChartsHost {}

describe('chart-frame.css', () => {
  // A page's scroll body (neat-page's) is not positioned. Without a positioned host, the visually
  // hidden live region's containing block is the viewport, so a chart below the fold makes the
  // whole document scroll. jsdom does no layout: the app's e2e page-overflow check is the
  // behavior test, this pins the rule that makes it pass.
  it('makes the host the containing block of the chart’s absolutely positioned parts', () => {
    expect(declared(':host', 'position')).toBe('relative');
  });

  it('neither clips the host nor makes it a stacking context, so a readout still hangs over the next card', () => {
    expect(rule(':host')).not.toMatch(CLIPS_OR_STACKS);
  });

  for (const selector of ['neat-time-chart', 'neat-stacked-chart', 'neat-heatmap']) {
    it(`${selector}: keeps its live region a child of its host, the box the sheet positions`, async () => {
      const fixture = TestBed.createComponent(ChartsHost);
      await fixture.whenStable();
      const host = (fixture.nativeElement as HTMLElement).querySelector(selector)!;

      expect(host.querySelector('[aria-live]')!.parentElement).toBe(host);
    });
  }
});
