import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatPage } from '@sima/neat-ui';
import {
  NeatChartCard,
  NeatChartFormat,
  NeatChartTone,
  NeatHeatmap,
  NeatHeatmapRow,
  NeatReference,
  NeatSeries,
  NeatSparkline,
  NeatStackedChart,
  NeatThreshold,
  NeatTimeChart,
} from '@sima/neat-ui/charts';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';

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
  imports: [
    NeatChartCard,
    NeatHeatmap,
    NeatPage,
    NeatSparkline,
    NeatStackedChart,
    NeatStatusChip,
    NeatTimeChart,
  ],
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
          <h2>Chart card</h2>
          <p class="showcase-muted">
            <code>neat-chart-card</code> is the card a metric sits on: its heading with a
            <code>neatChartCardChip</code> beside it, the value with its unit, a caption and the
            chart. It sets <code>--neat-surface</code> to <code>--card</code> for the charts' label
            halos. A <code>selectable</code> card is one choice of several: its heading is a button
            (<code>aria-current</code> while <code>selected</code>) and a click on the card chooses
            it too, but a click on a chart's plot keeps the plot's readout. Without
            <code>selectable</code>, the heading is text and clicks do nothing, as on a tile.
          </p>
          <div class="chart-grid">
            <neat-chart-card
              heading="CPU usage"
              value="34"
              unit="%"
              caption="All cores"
              selectable
              [selected]="chosen() === 'cpu'"
              (activate)="chosen.set('cpu')"
            >
              <neat-time-chart
                label="CPU usage"
                headless
                size="compact"
                [series]="cpu"
                [times]="times"
                [domain]="[0, 100]"
                [format]="percent"
              />
            </neat-chart-card>
            <neat-chart-card
              heading="MLA temperature"
              value="78.2"
              unit="°C"
              caption="Hottest of 8 sensors"
              selectable
              [selected]="chosen() === 'mla'"
              (activate)="chosen.set('mla')"
            >
              <neat-status-chip neatChartCardChip tone="warning">Warning</neat-status-chip>
              <neat-sparkline
                label="MLA temperature"
                tone="warning"
                [values]="temperature[0].values"
                [format]="celsius"
              />
            </neat-chart-card>
            <neat-chart-card
              heading="Fan speed"
              value="Not reported"
              caption="The board does not report it"
              selectable
              [selected]="chosen() === 'fan'"
              (activate)="chosen.set('fan')"
            />
            <neat-chart-card heading="Board power" value="11.4" unit="W" caption="Now" />
          </div>
          <p class="showcase-code showcase-muted">Chosen: {{ chosen() }}</p>
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

        <section class="showcase-section">
          <h2>Stacked chart</h2>
          <p class="showcase-muted">
            <code>neat-stacked-chart</code> splits a total into bands, bottom first in the order
            given, in <code>--neat-series-1</code> to <code>-8</code>. The legend gives each band's
            current value and its share of the current total, which the eight colours alone cannot
            tell apart. A sample where any band is missing breaks the whole stack: here the board
            did not report for a while. The readout reads "Total" and then each band, with the time
            chart's keys.
          </p>
          <div class="chart-grid">
            <div class="chart-card">
              <neat-stacked-chart
                label="Where the power goes"
                headline="11.2 W"
                [series]="rails"
                [times]="times"
                [domain]="[0, 16]"
                [format]="watts"
              />
            </div>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Heatmap</h2>
          <p class="showcase-muted">
            <code>neat-heatmap</code> shows one row per metric, split into at most 48 columns of
            time, each cell the mean of its samples. A cell mixes <code>--neat-heat-low</code> and
            <code>--neat-heat-high</code> by its place in the domain, and a column with no samples
            is empty. The grid is one tab stop: the arrow keys move a cell cursor, Home and End go
            to the ends of a row, and each key announces the cell. Each row ends in a figure in its
            tone's line colour.
          </p>
          <div class="chart-grid">
            <div class="chart-card chart-wide">
              <neat-heatmap
                label="Per-core CPU"
                headline="47%"
                [rows]="coreRows"
                [times]="times"
                [format]="percent"
              />
            </div>
          </div>
        </section>
      </div>
    </neat-page>
  `,
  styleUrl: './charts.page.css',
})
export class ChartsPage {
  protected readonly chosen = signal('cpu');
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
  /** Eight rails that sum to about 11 W: the stacked chart uses all eight series colours. */
  protected readonly rails: readonly NeatSeries[] = [
    { key: 'core', label: 'Core', low: 3.2, high: 4.6 },
    { key: 'mla', label: 'MLA', low: 1.5, high: 3.4 },
    { key: 'ddr', label: 'DDR', low: 1.2, high: 1.9 },
    { key: 'cam', label: 'Camera', low: 0.6, high: 1.1 },
    { key: 'net', label: 'Network', low: 0.4, high: 0.9 },
    { key: 'sto', label: 'Storage', low: 0.3, high: 0.6 },
    { key: 'fan', label: 'Fan', low: 0.2, high: 0.5 },
    { key: 'board', label: 'Board', low: 0.5, high: 0.7 },
  ].map(({ key, label, low, high }, index) => {
    const values = sine(SAMPLES, 1.5 + index / 3, low, high);
    // One rail does not report for a minute, which breaks the stack there.
    return { key, label, values: index === 2 ? withGap(values, 40, 15) : values };
  });

  /** Sixteen cores: some idle, some busy, the last few near the limit. */
  protected readonly coreRows: readonly NeatHeatmapRow[] = Array.from(
    { length: 16 },
    (_, index) => {
      const values = sine(SAMPLES, 1 + index / 5, 5 + index * 2, 35 + index * 4);
      const recent = values.slice(-15).reduce((sum, value) => sum + value, 0) / 15;
      return {
        key: `core${index}`,
        label: `Core ${index}`,
        values,
        end: percent(recent),
        endTone: recent >= 85 ? 'danger' : recent >= 70 ? 'warning' : 'default',
      };
    },
  );

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
