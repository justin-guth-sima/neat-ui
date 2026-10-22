import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { NeatButton } from '../button/button';
import { NeatIcon } from '../icon/icon';
import { KioskService } from './kiosk.service';

/**
 * The floating "Exit kiosk mode" control the shell shows in kiosk mode: a 48px circle, above the
 * 44px minimum touch target. It fades out while the pointer rests and back in on pointer or touch
 * input. Faded, it stays in the tab order and the accessibility tree, and focus the browser shows
 * (`:focus-visible`, keyboard use) keeps it visible, so it is reachable without a pointer. Internal
 * to the shell: not part of the public API.
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
      [attr.data-shown]="shown()"
      (click)="kiosk.exit()"
    >
      <neat-icon name="kiosk-exit" />
    </button>
  `,
  styles: `
    /*
     * Faded out but still focusable; a tap on it only wakes it, the next one activates it. The
     * browser decides :focus-visible live, so focus that a click gave the control (entering kiosk
     * mode by click) lets it fade, and a key press afterwards brings it back before Enter acts.
     */
    button[data-shown='false']:not(:focus-visible) {
      opacity: 0;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: no-preference) {
      button {
        transition: opacity var(--neat-transition-duration);
      }
    }

    /* Helm's transition-all would otherwise still animate the fade. */
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `,
})
export class NeatKioskExit {
  protected readonly kiosk = inject(KioskService);
  private readonly control = viewChild.required<NeatButton, ElementRef<HTMLElement>>(NeatButton, {
    read: ElementRef,
  });

  protected readonly shown = computed(() => !this.kiosk.pointerIdle());

  focus(): void {
    this.control().nativeElement.focus();
  }
}
