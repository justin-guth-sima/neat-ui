import { signal, type Signal, type WritableSignal } from '@angular/core';

/**
 * An open dialog, as the code that opened it and the dialog's own content see it. `NeatDialog.open`
 * returns it, and a component used as dialog content gets the same ref by injection:
 * `inject<NeatDialogRef<Result>>(NeatDialogRef)`. A template used as content gets it as the
 * template's implicit context: `<ng-template let-dialog>`.
 *
 * Only `NeatDialog` creates one.
 */
export abstract class NeatDialogRef<R = unknown> {
  /**
   * Settles once the dialog has closed and focus is back on the element that had it: with the
   * result given to `close`, or `undefined` when it was dismissed (Escape, the backdrop, the close
   * button) or closed by navigation. Navigating (the browser's Back button, a route change)
   * closes every dialog, dismissible or not; code that must not lose work to it has to guard the
   * navigation itself.
   */
  abstract readonly closed: Promise<R | undefined>;
  /** Whether Escape, the backdrop and the close button close the dialog right now. */
  abstract readonly dismissible: Signal<boolean>;

  /**
   * Closes the dialog; `closed` settles with the result. Closing a dialog that is already closing
   * changes nothing, so the first result stands.
   */
  abstract close(result?: R): void;

  /**
   * Allows or blocks closing from outside the dialog's own controls: while `false`, Escape and a
   * click on the backdrop do nothing and the close button is dimmed (`aria-disabled`) and does
   * nothing. For a dialog that is busy and would lose work if it closed; `close()` still works,
   * since the code that is busy calls it. Navigation still closes it (see `closed`).
   */
  abstract setDismissible(dismissible: boolean): void;
}

/** What `NeatDialog` gives a ref when it opens a dialog. */
export interface DialogRefInit<R> {
  /** Whether Escape, the backdrop and the close button close the dialog to begin with. */
  readonly dismissible: boolean;
  /** Starts closing the dialog with the result. */
  readonly close: (result?: R) => void;
  /** Settles once the dialog has closed and focus is back on the element that had it. */
  readonly closed: Promise<R | undefined>;
}

/** The ref `NeatDialog` hands out; not exported by the entry. */
export class DialogRefImpl<R> extends NeatDialogRef<R> {
  private readonly dismissibleState: WritableSignal<boolean>;
  private readonly closeDialog: (result?: R) => void;
  readonly closed: Promise<R | undefined>;
  readonly dismissible: Signal<boolean>;

  constructor(init: DialogRefInit<R>) {
    super();
    this.dismissibleState = signal(init.dismissible);
    this.dismissible = this.dismissibleState.asReadonly();
    this.closeDialog = init.close;
    this.closed = init.closed;
  }

  close(result?: R): void {
    this.closeDialog(result);
  }

  setDismissible(dismissible: boolean): void {
    this.dismissibleState.set(dismissible);
  }
}
