import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  viewChild,
} from '@angular/core';
import { CHAT_CLOCK } from './chat-clock';

/**
 * A waiting reply's orb and clock: an orb that turns once a second (still under reduced motion)
 * and the seconds since it appeared, "to the first word". The clock is written once a frame,
 * outside change detection. Both are hidden from assistive technology; the transcript says
 * "Waiting for the reply" in words. Internal to the transcript.
 */
@Component({
  selector: 'neat-chat-orb',
  host: { 'aria-hidden': 'true' },
  template: `<span class="orb"></span
    ><span class="clock"
      ><span class="figure"><span #seconds class="seconds">0.00</span> s</span
      ><span class="caption">to the first word</span></span
    >`,
  styleUrl: './orb.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeatChatOrb {
  private readonly seconds = viewChild.required<ElementRef<HTMLElement>>('seconds');

  constructor() {
    const clock = inject(CHAT_CLOCK);
    const zone = inject(NgZone);
    const since = clock.now();
    let handle: number | null = null;
    const tick = () => {
      handle = clock.request(tick);
      const text = ((clock.now() - since) / 1000).toFixed(2);
      const element = this.seconds().nativeElement;
      if (element.textContent !== text) element.textContent = text;
    };
    afterNextRender(() => zone.runOutsideAngular(() => (handle = clock.request(tick))));
    inject(DestroyRef).onDestroy(() => {
      if (handle !== null) clock.cancel(handle);
    });
  }
}
