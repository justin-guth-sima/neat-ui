import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NeatButton } from '../button/button';
import { NeatIcon } from '../icon/icon';
import { KioskService } from './kiosk.service';

/**
 * The floating "Exit kiosk mode" control the shell shows in kiosk mode: a 48px circle, above the
 * 44px minimum touch target. It fades out while the pointer rests and back in on pointer or touch
 * input. Faded, it stays in the tab order and the accessibility tree, and keyboard focus keeps it
 * visible, so it is reachable without a pointer. Internal to the shell: not part of the public API.
 */
@Component({
  selector: 'neat-kiosk-exit',
  imports: [NeatButton, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #control
      neatButton
      type="button"
      class="shadow-md"
      variant="secondary"
      size="touch"
      rounded
      iconOnly
      aria-label="Exit kiosk mode"
      [attr.data-shown]="shown()"
      (focus)="keyboardFocus.set(control.matches(':focus-visible'))"
      (blur)="keyboardFocus.set(false)"
      (click)="kiosk.exit()"
    >
      <neat-icon name="kiosk-exit" />
    </button>
  `,
  styles: `
    button[data-shown='true'] {
      opacity: 1;
    }

    /* Faded out but still focusable; a tap on it only wakes it, the next one activates it. */
    button[data-shown='false'] {
      opacity: 0;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: no-preference) {
      button {
        transition: opacity var(--neat-transition-duration);
      }
    }
  `,
})
export class NeatKioskExit {
  protected readonly kiosk = inject(KioskService);
  private readonly control = viewChild.required<ElementRef<HTMLButtonElement>>('control');

  /**
   * Focus the browser shows (`:focus-visible`: keyboard focus, or scripted focus after keyboard
   * use) keeps the control visible. Focus after a pointer click does not, so the control the shell
   * focuses on entering kiosk mode by click still fades on a booth display.
   */
  protected readonly keyboardFocus = signal(false);
  protected readonly shown = computed(() => !this.kiosk.pointerIdle() || this.keyboardFocus());

  focus(): void {
    this.control().nativeElement.focus();
  }
}
