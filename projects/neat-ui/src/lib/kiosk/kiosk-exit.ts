import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { NeatButton } from '../button/button';
import { NeatIcon } from '../icon/icon';
import { KioskService } from './kiosk.service';

/**
 * The floating "Exit kiosk mode" control the shell shows in kiosk mode: a 48px circle, above the
 * 44px minimum touch target. The shell fades it, together with the page toolbar beside it, while
 * the pointer rests (see shell.css). Internal to the shell: not part of the public API.
 */
@Component({
  selector: 'neat-kiosk-exit',
  imports: [NeatButton, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      neatButton
      type="button"
      class="shadow-md"
      variant="secondary"
      size="touch"
      rounded
      iconOnly
      aria-label="Exit kiosk mode"
      (click)="exit()"
    >
      <neat-icon name="kiosk-exit" />
    </button>
  `,
})
export class NeatKioskExit {
  protected readonly kiosk = inject(KioskService);
  private readonly control = viewChild.required<NeatButton, ElementRef<HTMLElement>>(NeatButton, {
    read: ElementRef,
  });

  /** Kiosk mode was left with this control; the shell then decides where focus goes. */
  readonly exited = output<void>();

  focus(): void {
    this.control().nativeElement.focus();
  }

  protected exit(): void {
    void this.kiosk.exit();
    this.exited.emit();
  }
}
