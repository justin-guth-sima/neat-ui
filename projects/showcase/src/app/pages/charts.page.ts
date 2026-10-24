import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatPage } from '@sima/neat-ui';
import { NeatChartFormat, NeatChartTone, NeatSparkline } from '@sima/neat-ui/charts';

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

@Component({
  selector: 'app-charts-page',
  imports: [NeatPage, NeatSparkline],
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
      </div>
    </neat-page>
  `,
  styleUrl: './charts.page.css',
})
export class ChartsPage {
  private static readonly celsius: NeatChartFormat = (value) => `${value.toFixed(1)} °C`;

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
