import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NeatChartCard } from '@sima/neat-ui/charts';
import { NeatGauge } from '@sima/neat-ui/gauge';
import { REPLY_SPEEDS } from './data';

/**
 * A reply's speed in tokens per second, a new reading each second, in a chart card. The card's
 * heading says what it is, so the gauge shows no title of its own; the arc and the figure ease to
 * each reading.
 *
 * @animated
 */
@Component({
  selector: 'app-reply-speed',
  imports: [NeatChartCard, NeatGauge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-reply-speed.example.html',
  styleUrl: './reply-speed.example.css',
})
export class ReplySpeed {
  protected readonly speed = signal<number>(REPLY_SPEEDS[0]);

  constructor() {
    let step = 0;
    const timer = setInterval(
      () => this.speed.set(REPLY_SPEEDS[++step % REPLY_SPEEDS.length]),
      1000,
    );
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
