import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { NeatIcon } from '../icon/icon';
import { KioskService } from './kiosk.service';

/**
 * Button tokens for a tap-friendly control: a 3rem (48px) circle, above the 44px minimum touch
 * target, where Aura's large icon-only button is 2.625rem.
 */
const TAP_TARGET_TOKENS = { root: { lg: { iconOnlyWidth: '3rem' } } };

/**
 * The floating "Exit kiosk mode" control the shell shows in kiosk mode. It fades out while the
 * pointer rests and back in on pointer or touch input. Faded, it stays in the tab order and the
 * accessibility tree, and keyboard focus keeps it visible, so it is reachable without a pointer.
 * Internal to the shell: not part of the public API.
 */
@Component({
  selector: 'neat-kiosk-exit',
  imports: [ButtonDirective, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      pButton
      type="button"
      severity="secondary"
      size="large"
      rounded
      raised
      iconOnly
      [dt]="tapTargetTokens"
      aria-label="Exit kiosk mode"
      [attr.data-shown]="shown()"
      (focus)="focused.set(true)"
      (blur)="focused.set(false)"
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
        transition: opacity var(--p-transition-duration);
      }
    }
  `,
})
export class NeatKioskExit {
  protected readonly kiosk = inject(KioskService);
  protected readonly tapTargetTokens = TAP_TARGET_TOKENS;
  protected readonly focused = signal(false);
  protected readonly shown = computed(() => !this.kiosk.pointerIdle() || this.focused());
}
