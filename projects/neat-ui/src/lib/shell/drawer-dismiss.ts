import { DialogRef } from '@angular/cdk/dialog';
import { Directive, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

/**
 * The drawer's ways out from outside its content: Escape and a press on the scrim, as the kit's
 * dialogs have them (`NeatDialogPanel`). Internal to the shell: it sits on the drawer's panel,
 * inside the CDK dialog that brain's sheet opens, and tells the shell, which owns the open state.
 *
 * Brain's own closing is switched off on the sheet (`disableClose`), since brain closes on Escape
 * however the key was handled and lets it go on to `document`. Here a modal absorbs every Escape
 * that reaches it, whether or not it closes: page shortcuts on Escape must not fire behind the
 * drawer. It listens through the CDK's `keydownEvents`, which the topmost overlay alone gets from
 * `body`, so a key whose target is the CDK's container (focused by a press on the panel's empty
 * area) counts too. A control inside that handled the key first (`defaultPrevented`) keeps the
 * drawer open.
 */
@Directive({ selector: '[neatDrawerDismiss]' })
export class DrawerDismiss {
  /** Escape or the scrim asked the drawer to close. */
  readonly dismissed = output<void>();

  constructor() {
    const dialog = inject(DialogRef);
    dialog.backdropClick.pipe(takeUntilDestroyed()).subscribe(() => this.dismissed.emit());
    dialog.keydownEvents
      .pipe(
        filter((event) => event.key === 'Escape'),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        event.stopPropagation();
        if (event.defaultPrevented) return;
        event.preventDefault();
        this.dismissed.emit();
      });
  }
}
