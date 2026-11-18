import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type NeatChartTone, NeatSparkline } from '@sima/neat-ui/charts';
import { celsius, sine, withGap } from './data';

/**
 * A card for each tone, then a series with a gap, which splits the line, and a single sample,
 * which draws no line but keeps the box.
 *
 * @gallery
 */
@Component({
  selector: 'app-tones',
  imports: [NeatSparkline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-tones.example.html',
  styleUrl: './tones.example.css',
})
export class Tones {
  protected readonly celsius = celsius;
  protected readonly cards: readonly {
    readonly title: string;
    readonly values: readonly (number | null)[];
    readonly tone: NeatChartTone;
  }[] = [
    { title: 'Default', values: sine(120, 2, 40, 62), tone: 'default' },
    { title: 'Warning', values: sine(120, 3, 70, 88), tone: 'warning' },
    { title: 'Danger', values: sine(120, 1.5, 85, 99), tone: 'danger' },
    { title: 'With a gap', values: withGap(sine(120, 2, 40, 62), 50, 20), tone: 'default' },
    { title: 'One sample', values: [48], tone: 'default' },
  ];
}
