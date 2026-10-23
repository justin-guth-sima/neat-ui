import { inject, Injectable, TemplateRef, type Type } from '@angular/core';
import {
  BrnDialogRef,
  BrnDialogService,
  cssClassesToArray,
  type BrnDialogOptions,
} from '@spartan-ng/brain/dialog';
import {
  DIALOG_HELM_CLASSES,
  NeatDialogPanel,
  type DialogContext,
  type NeatDialogSize,
} from './dialog-panel';
import { NeatDialogRef } from './dialog-ref';

/** What `NeatDialog.open` takes besides the content. */
export interface NeatDialogOptions {
  /** Names the dialog: "Assign source". Shown as its heading. */
  title: string;
  /** The dialog's width on screens wider than a phone; `'medium'` by default. */
  size?: NeatDialogSize;
  /**
   * Whether Escape, a click on the backdrop and the close button close the dialog; `true` by
   * default. `NeatDialogRef.setDismissible` changes it while the dialog is open.
   */
  dismissible?: boolean;
}

/**
 * Brain's dialog behaviour on its service, with helm's backdrop: a modal centred on the page that
 * traps focus, hides the page from assistive technology and gives focus back on closing to
 * whatever had it on opening. Closing from outside is switched off here and done by the panel,
 * which can change its mind while the dialog is open (see `NeatDialogPanel`).
 */
const DIALOG_OPTIONS: Partial<BrnDialogOptions> = {
  disableClose: true,
  // As a list: the service hands it to the CDK as given, which adds each entry as one class.
  backdropClass: cssClassesToArray(DIALOG_HELM_CLASSES.overlay),
};

/**
 * Opens modal dialogs whose content is the app's own:
 *
 * ```ts
 * const dialog = this.dialogs.open<string>(this.renameForm, { title: 'Rename source' });
 * const name = await dialog.closed; // undefined if it was dismissed
 * ```
 *
 * The content is a template or a component. It is rendered under the title the options name the
 * dialog by, and is built from `<neat-dialog-body>` (the part that scrolls) and
 * `<neat-dialog-actions>` (the buttons). It gets the `NeatDialogRef`, to close the dialog with a
 * result or to block dismissing it while it is busy: a template as its implicit context
 * (`<ng-template let-dialog>`), a component by injection.
 *
 * The dialog is modal: focus moves into it and stays inside, the page behind is hidden from
 * assistive technology, and Escape or a click on the backdrop close it while it is dismissible.
 * On closing, focus goes back to the element that had it on opening. Dialogs can stack; Escape
 * closes the topmost. For a yes/no question use `NeatConfirm`, which this does not replace.
 *
 * In kiosk mode a dialog does not hold the floating toolbar (as `neat-popover` does): the dialog
 * covers the page, and the toolbar behind it fading is as it should be. Closing returns focus to
 * the button in the toolbar, which shows the toolbar again.
 */
@Injectable({ providedIn: 'root' })
export class NeatDialog {
  private readonly dialogs = inject(BrnDialogService);

  open<R = unknown>(
    content: TemplateRef<unknown> | Type<unknown>,
    options: NeatDialogOptions,
  ): NeatDialogRef<R> {
    // The ref exists before the dialog does, since the content is built while the dialog opens and
    // may ask for it; it closes through the dialog, which is there by the time anyone calls it.
    let resolveClosed: (result: R | undefined) => void;
    const closed = new Promise<R | undefined>((resolve) => (resolveClosed = resolve));
    const ref = new NeatDialogRef<R>({
      dismissible: options.dismissible ?? true,
      close: (result) => dialog.close(result),
      closed,
    });
    const context: DialogContext = {
      title: options.title,
      size: options.size ?? 'medium',
      content,
      // The panel only hands it on and closes it without a result; its result type is the opener's.
      ref: ref as NeatDialogRef,
    };

    const dialog: BrnDialogRef<R> = this.dialogs.open<DialogContext, R>(
      NeatDialogPanel,
      undefined,
      context,
      DIALOG_OPTIONS,
    );
    dialog.closed$.subscribe((result) => resolveClosed(result));
    return ref;
  }
}
