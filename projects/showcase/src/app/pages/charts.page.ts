import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatPage } from '@sima/neat-ui';
import {
  NeatChartFormat,
  NeatChartTone,
  NeatReference,
  NeatSeries,
  NeatSparkline,
  NeatThreshold,
  NeatTimeChart,
} from '@sima/neat-ui/charts';

/** A sine wave of `count` samples, the demo data of every chart: a plausible, smooth metric. */
function sine(count: number, cycles: number, low: number, high: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const wave = (Math.sin((index / count) * cycles * 2 * Math.PI) + 1) / 2;
    return Number((low + wave * (high - low)).toFixed(2));
  });
}

/** The same with `gap` samples missing from `from`: a daemon that did not answer for a while. */
function withGap(values: number[], from: number, gap: number): (number | null)[] {
  return values.map((value, index) => (index >= from && index < from + gap ? null : value));
}

/** Eight minutes of samples four seconds apart, ending at a fixed instant so the demo stands still. */
const SAMPLES = 120;
const TIMES: readonly number[] = Array.from(
  { length: SAMPLES },
  (_, index) => Date.UTC(2026, 9, 24, 12, 0, 0) + index * 4000,
);

const percent: NeatChartFormat = (value) => `${value.toFixed(0)}%`;
const celsius: NeatChartFormat = (value) => `${value.toFixed(1)} °C`;
const watts: NeatChartFormat = (value) => `${value.toFixed(1)} W`;

@Component({
  selector: 'app-charts-page',
  imports: [NeatPage, NeatSparkline, NeatTimeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Sparkline</h2>
          <p class="showcase-muted">
            <code>neat-sparkline</code> draws a metric's recent samples as a small line, from the
            lowest at the bottom to the highest at the top. A missing sample splits the line, and
            fewer than two numbers draw nothing but keep the box, so a card does not jump. Its
            stroke is <code>--neat-line</code>, or <code>--neat-line-warning</code> and
            <code>--neat-line-danger</code> by <code>tone</code>.
          </p>
          <div class="showcase-row">
            @for (demo of demos; track demo.title) {
              <div class="card">
                <span class="card-title">{{ demo.title }}</span>
                <neat-sparkline
                  [values]="demo.values"
                  [label]="demo.title"
                  [format]="demo.format"
                  [tone]="demo.tone"
                />
              </div>
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Time chart</h2>
          <p class="showcase-muted">
            <code>neat-time-chart</code> draws samples where their times put them, over a domain the
            app fixes, so the line never rescales under the reader. Hover the plot, or tab to it and
            use the arrow keys, Home, End and Escape, for the readout. One series takes its tone's
            line token; several take <code>--neat-series-1</code> to <code>-8</code> with a legend,
            and beyond eight the rest fold into Other. A missing sample breaks the line, and a lone
            sample is only its dot.
          </p>
          <div class="chart-grid">
            <div class="chart-card">
              <neat-time-chart
                label="CPU usage"
                headline="34%"
                size="large"
                [series]="cpu"
                [times]="times"
                [domain]="[0, 100]"
                [thresholds]="cpuThresholds"
                [format]="percent"
              />
            </div>
            <div class="chart-card">
              <neat-time-chart
                label="MLA temperature"
                headline="78.2 °C"
                tone="warning"
                [series]="temperature"
                [times]="times"
                [domain]="[40, 100]"
                [thresholds]="temperatureThresholds"
                [format]="celsius"
              />
            </div>
            <div class="chart-card">
              <neat-time-chart
                label="Cluster load"
                [series]="clusters"
                [times]="times"
                [domain]="[0, 100]"
                [format]="percent"
              />
            </div>
            <div class="chart-card">
              <neat-time-chart
                label="Board power"
                headline="11.4 W"
                size="large"
                [series]="power"
                [times]="times"
                [domain]="[0, 16]"
                [reference]="powerAverage"
                [format]="watts"
              />
            </div>
            <div class="chart-card">
              <neat-time-chart
                label="Ten cores"
                size="large"
                [series]="cores"
                [times]="times"
                [domain]="[0, 100]"
                [format]="percent"
              />
            </div>
            <div class="chart-card chart-rows">
              @for (row of rows; track row.label) {
                <div class="chart-row">
                  <span>{{ row.label }}</span>
                  <neat-time-chart
                    [label]="row.label"
                    size="compact"
                    headless
                    [series]="row.series"
                    [times]="row.times"
                    [domain]="[0, 100]"
                    [format]="percent"
                  />
                  <span>{{ row.value }}</span>
                </div>
              }
            </div>
          </div>
        </section>
      </div>
    </neat-page>
  `,
  styleUrl: './charts.page.css',
})
export class ChartsPage {
  private static readonly celsius: NeatChartFormat = (value) => `${value.toFixed(1)} °C`;

  protected readonly times = TIMES;
  protected readonly percent = percent;
  protected readonly celsius = celsius;
  protected readonly watts = watts;

  protected readonly cpu: readonly NeatSeries[] = [
    { key: 'cpu', label: 'CPU', values: sine(SAMPLES, 3, 20, 62) },
  ];
  protected readonly cpuThresholds: readonly NeatThreshold[] = [
    { value: 70, tone: 'warning', label: 'Warning 70%' },
    { value: 90, tone: 'danger', label: 'Critical 90%' },
  ];
  protected readonly temperature: readonly NeatSeries[] = [
    { key: 'mla', label: 'MLA', values: withGap(sine(SAMPLES, 2, 62, 80), 50, 14) },
  ];
  protected readonly temperatureThresholds: readonly NeatThreshold[] = [
    { value: 70, tone: 'warning', label: 'Warning 70 °C' },
    { value: 85, tone: 'danger', label: 'Critical 85 °C' },
  ];
  protected readonly clusters: readonly NeatSeries[] = [
    { key: 'a', label: 'Cluster A', values: sine(SAMPLES, 2, 30, 70) },
    { key: 'b', label: 'Cluster B', values: sine(SAMPLES, 3, 10, 50) },
    { key: 'c', label: 'Cluster C', values: sine(SAMPLES, 1.5, 40, 90) },
  ];
  protected readonly power: readonly NeatSeries[] = [
    { key: 'power', label: 'Power', values: sine(SAMPLES, 2.5, 8, 13) },
  ];
  protected readonly powerAverage: NeatReference = { value: 10.5, label: 'Session average 10.5 W' };
  protected readonly cores: readonly NeatSeries[] = Array.from({ length: 10 }, (_, index) => ({
    key: `core${index}`,
    label: `Core ${index}`,
    values: sine(SAMPLES, 1 + index / 4, 5 + index * 3, 25 + index * 6),
  }));
  /** A list of metrics, one compact chart a row: two that fill the window and one just started. */
  protected readonly rows = [
    {
      label: 'Core 0',
      series: [{ key: 'core0', label: 'Core 0', values: sine(SAMPLES, 2, 20, 60) }],
      times: TIMES,
      value: '42%',
    },
    {
      label: 'Core 1',
      series: [{ key: 'core1', label: 'Core 1', values: sine(SAMPLES, 3, 30, 70) }],
      times: TIMES,
      value: '57%',
    },
    {
      label: 'One sample',
      series: [{ key: 'lone', label: 'One sample', values: [48] }],
      times: [TIMES[0]],
      value: '48%',
    },
  ] satisfies readonly {
    label: string;
    series: readonly NeatSeries[];
    times: readonly number[];
    value: string;
  }[];

  protected readonly demos: readonly {
    readonly title: string;
    readonly values: readonly (number | null)[];
    readonly format: NeatChartFormat;
    readonly tone: NeatChartTone;
  }[] = [
    { title: 'Default', values: sine(120, 2, 40, 62), format: ChartsPage.celsius, tone: 'default' },
    { title: 'Warning', values: sine(120, 3, 70, 88), format: ChartsPage.celsius, tone: 'warning' },
    { title: 'Danger', values: sine(120, 1.5, 85, 99), format: ChartsPage.celsius, tone: 'danger' },
    {
      title: 'With a gap',
      values: withGap(sine(120, 2, 40, 62), 50, 20),
      format: ChartsPage.celsius,
      tone: 'default',
    },
    { title: 'One sample', values: [48], format: ChartsPage.celsius, tone: 'default' },
  ];
}
