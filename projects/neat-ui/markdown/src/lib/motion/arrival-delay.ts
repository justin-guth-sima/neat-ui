import { Directive, ElementRef, inject, input, type OnInit } from '@angular/core';
import { MOTION_CLOCK } from './motion-clock';

/**
 * Starts its host's animation when its piece arrived: the animation's delay is the arrival time
 * less now, set once on init. So a piece that Angular re-creates while it moves resumes where it
 * was instead of starting again. A null time (a letter shown before) sets nothing. Internal.
 */
@Directive({ selector: '[neatArrivalAt]' })
export class ArrivalDelay implements OnInit {
  /** When the piece arrived, on the motion clock (ms). */
  readonly neatArrivalAt = input.required<number | null>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly clock = inject(MOTION_CLOCK);

  ngOnInit(): void {
    const at = this.neatArrivalAt();
    if (at === null) return;
    this.host.nativeElement.style.animationDelay = `${at - this.clock.now()}ms`;
  }
}
