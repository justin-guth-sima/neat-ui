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
  styleUrl: './kiosk-exit.css',
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
