import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { KIOSK_POINTER_IDLE_MS, KioskService, NeatButton } from '@sima/neat-ui';

/**
 * Kiosk mode for an expo, from `KioskService`.
 *
 * `toggle()` enters it, which hides the shell's rail and top bar and asks for fullscreen.
 * `toggle()` leaves it too, as a floating exit control does.
 *
 * `pointerIdle` turns true once the pointer has rested for `KIOSK_POINTER_IDLE_MS`, which is how a
 * page hides its own chrome. A component that has UI of its own outside the floating bar holds the
 * bar open with `holdToolbar()`, until it releases it.
 *
 * @unpictured
 */
@Component({
  selector: 'app-kiosk',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-kiosk.example.html',
  styleUrl: './kiosk.example.css',
})
export class Kiosk {
  protected readonly kiosk = inject(KioskService);
  protected readonly idleSeconds = KIOSK_POINTER_IDLE_MS / 1000;
  /** Releases the hold the button took; null while there is none. */
  protected readonly release = signal<(() => void) | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release()?.());
  }

  protected hold(): void {
    const release = this.release();
    if (release) {
      release();
      this.release.set(null);
    } else {
      this.release.set(this.kiosk.holdToolbar());
    }
  }
}
