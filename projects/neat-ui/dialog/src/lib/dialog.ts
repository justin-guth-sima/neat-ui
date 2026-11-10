import {
  inject,
  Injectable,
  type InputSignalWithTransform,
  TemplateRef,
  type Type,
} from '@angular/core';
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
import { DialogRefImpl, type NeatDialogRef } from './dialog-ref';

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
 * The inputs of a component `C` that `NeatDialog.open` can set: each signal input (`input()`,
 * `input.required()`, and `model()`, which is one too) by its property name, with the type it
 * takes. All are optional here, since the type cannot tell a required input from one with a
 * default; a required one left out fails when the component reads it, as it would in a template.
 *
 * Do not alias an input of a dialog component (`input(…, { alias })`): the type names inputs by
 * property, Angular binds them by alias, and an aliased one passed here throws as the dialog
 * opens. The alias lives in the component's metadata, out of the type's reach.
 */
export type NeatDialogInputs<C> = {
  readonly [K in keyof C as [InputValue<C[K]>] extends [never] ? never : K]?: InputValue<C[K]>;
};

/**
 * What a signal input takes when it is set; `never` for a member that is no signal input. The read
 * type is inferred though unused: the input's node holds it both ways (a value out, a value in),
 * so a fixed `unknown` in its place would match no input at all.
 */
type InputValue<S> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  S extends InputSignalWithTransform<infer Read, infer Write> ? Write : never;

/** What `NeatDialog.open` takes for a component whose inputs the opener sets. */
export interface NeatDialogComponentOptions<C> extends NeatDialogOptions {
  /**
   * Values for the component's inputs, set as it is created, before its first change detection,
   * as a template's bindings would be: the component sees them in its template, in `computed`
   * and `linkedSignal`, and from `ngOnInit` on, but not in a field initializer or its constructor.
   * They are set once; the dialog does not follow later changes.
   */
  readonly inputs: NeatDialogInputs<C>;
}

/**
 * Brain's dialog behavior on its service, with helm's backdrop: a modal centered on the page that
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
 * A component can take inputs from the opener, typed by the component (a template needs none: it
 * sees the opener's own fields):
 *
 * ```ts
 * const dialog = this.dialogs.open<ImportDialog, string | null>(ImportDialog, {
 *   title: 'Import media',
 *   inputs: { openingTab: 'youtube' },
 * });
 * ```
 *
 * With `inputs` the type arguments are the component's, then the result's; both are inferred when
 * none is given, the result as `unknown`.
 *
 * The dialog is modal: focus moves into it and stays inside, the page behind is hidden from
 * assistive technology, and Escape or a click on the backdrop close it while it is dismissible.
 * On closing, focus goes back to the element that had it on opening. Dialogs can stack; Escape
 * closes the topmost, and a handled Escape stops there: it never reaches `document` or `window`
 * listeners. Navigation (the browser's Back button, a route change) closes a dialog even when it
 * is not dismissible, and `closed` then settles with `undefined`. For a yes/no question use
 * `NeatConfirm`, which this does not replace.
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
  ): NeatDialogRef<R>;
  open<C, R = unknown>(content: Type<C>, options: NeatDialogComponentOptions<C>): NeatDialogRef<R>;
  open<R>(
    content: TemplateRef<unknown> | Type<unknown>,
    options: NeatDialogOptions & { readonly inputs?: Readonly<Record<string, unknown>> },
  ): NeatDialogRef<R> {
    // The ref exists before the dialog does, since the content is built while the dialog opens and
    // may ask for it; it closes through the dialog, which is there by the time anyone calls it.
    let resolveClosed: (result: R | undefined) => void;
    const closed = new Promise<R | undefined>((resolve) => (resolveClosed = resolve));
    const ref = new DialogRefImpl<R>({
      dismissible: options.dismissible ?? true,
      close: (result) => dialog.close(result),
      closed,
    });
    const context: DialogContext = {
      title: options.title,
      size: options.size ?? 'medium',
      content,
      inputs: options.inputs ?? {},
      ref,
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
