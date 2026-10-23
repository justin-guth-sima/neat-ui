import { signal, type Signal, type WritableSignal } from '@angular/core';

/** What `NeatDialog` gives a ref when it opens a dialog. */
export interface NeatDialogRefInit<R> {
  /** Whether Escape, the backdrop and the close button close the dialog to begin with. */
  readonly dismissible: boolean;
  /** Starts closing the dialog with the result. */
  readonly close: (result?: R) => void;
  /** Settles once the dialog has closed and focus is back on the element that had it. */
  readonly closed: Promise<R | undefined>;
}

/**
 * An open dialog, as the code that opened it and the dialog's own content see it. `NeatDialog.open`
 * returns it, and a component used as dialog content gets the same ref by injection:
 * `inject<NeatDialogRef<Result>>(NeatDialogRef)`. A template used as content gets it as the
 * template's implicit context: `<ng-template let-dialog>`.
 *
 * Created by `NeatDialog`; apps do not construct one.
 */
export class NeatDialogRef<R = unknown> {
  private readonly dismissibleState: WritableSignal<boolean>;
  private readonly closeDialog: (result?: R) => void;

  /**
   * Settles once the dialog has closed and focus is back on the element that had it: with the
   * result given to `close`, or `undefined` for Escape, the backdrop and the close button.
   */
  readonly closed: Promise<R | undefined>;
  /** Whether Escape, the backdrop and the close button close the dialog right now. */
  readonly dismissible: Signal<boolean>;

  constructor(init: NeatDialogRefInit<R>) {
    this.dismissibleState = signal(init.dismissible);
    this.dismissible = this.dismissibleState.asReadonly();
    this.closeDialog = init.close;
    this.closed = init.closed;
  }

  /**
   * Closes the dialog; `closed` settles with the result. Closing a dialog that is already closing
   * changes nothing, so the first result stands.
   */
  close(result?: R): void {
    this.closeDialog(result);
  }

  /**
   * Allows or blocks closing from outside the dialog's own controls: while `false`, Escape and a
   * click on the backdrop do nothing and the close button is gone. For a dialog that is busy and
   * would lose work if it closed; `close()` still works, since the code that is busy calls it.
   */
  setDismissible(dismissible: boolean): void {
    this.dismissibleState.set(dismissible);
  }
}
