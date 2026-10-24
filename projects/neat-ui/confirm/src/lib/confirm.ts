import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BRN_ALERT_DIALOG_DEFAULT_OPTIONS,
  BrnAlertDialogDescription,
  BrnAlertDialogTitle,
} from '@spartan-ng/brain/alert-dialog';
import {
  BrnDialogRef,
  BrnDialogService,
  cssClassesToArray,
  injectBrnDialogContext,
} from '@spartan-ng/brain/dialog';
import { filter } from 'rxjs';
import { NeatButton, ɵhlm as hlm } from '@sima/neat-ui';

/** What `NeatConfirm.ask` asks: the copy of the dialog and the weight of its confirm button. */
export interface NeatConfirmOptions {
  /** The question, which names the dialog: "Reset all channels to global?". */
  title: string;
  /** What confirming does, which describes the dialog. */
  message: string;
  /** The confirm button's label, a verb for the action: "Reset". */
  confirmLabel: string;
  /** The cancel button's label; `'Cancel'` by default. */
  cancelLabel?: string;
  /** `'danger'` for an action that destroys or cannot be undone; `'default'` by default. */
  tone?: 'default' | 'danger';
}

/**
 * Helm's alert-dialog classes (`lib/ui/alert-dialog`), copied because helm keeps them inline.
 * confirm.spec checks that each string still appears in the vendored helm, so a helm update that
 * changes one fails until this table is reviewed.
 */
export const CONFIRM_HELM_CLASSES = {
  /** `hlm-alert-dialog-content.ts`: the panel. */
  content:
    'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 bg-popover text-popover-foreground ring-foreground/10 gap-6 rounded-xl p-6 ring-1 duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg group/alert-dialog-content grid w-full outline-none',
  /** `hlm-alert-dialog-header.ts`: title above message. */
  header:
    'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-start sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]',
  /** `hlm-alert-dialog-title.ts`. */
  title:
    'text-lg font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
  /** `hlm-alert-dialog-description.ts`: the message. */
  description:
    'text-muted-foreground *:[a]:hover:text-foreground text-sm text-balance md:text-pretty *:[a]:underline *:[a]:underline-offset-3',
  /** `hlm-alert-dialog-footer.ts`: the buttons, stacked on narrow screens. */
  footer:
    'flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end',
  /** `hlm-alert-dialog-overlay.ts`: the backdrop over the page. */
  overlay:
    'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 isolate bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs',
} as const;

/**
 * The panel: helm's, outlined in `--border` where helm draws the text colour at 10%, as the
 * popover's panel is.
 */
const CONTENT_CLASSES = hlm(CONFIRM_HELM_CLASSES.content, 'ring-border');

/**
 * The attribute on the cancel button in the template below, where focus starts: the choice that
 * changes nothing.
 */
const CANCEL_ATTRIBUTE = 'data-neat-confirm-cancel';

/**
 * Brain's alert-dialog behaviour (role `alertdialog`, a backdrop click does not close it) on its
 * dialog service: a modal centred on the page that traps focus, closes on Escape and gives focus
 * back on closing to whatever had it on opening.
 */
const DIALOG_OPTIONS = {
  ...BRN_ALERT_DIALOG_DEFAULT_OPTIONS,
  autoFocus: `[${CANCEL_ATTRIBUTE}]`,
  // As a list: the service hands it to the CDK as given, which adds each entry as one class.
  backdropClass: cssClassesToArray(CONFIRM_HELM_CLASSES.overlay),
};

interface ConfirmContext {
  readonly options: Required<NeatConfirmOptions>;
  /** Records the pressed button's answer and closes the dialog with it. */
  readonly answer: (confirmed: boolean) => void;
}

/** An asked question: its dialog, and the answer once a button was pressed. */
interface Question {
  readonly dialogRef: BrnDialogRef<boolean>;
  answer?: boolean;
}

/**
 * The dialog's content, rendered by `NeatConfirm` inside the CDK dialog container, which carries
 * the role and the modal state. Brain's title and description name and describe that container.
 * Escape closes it (brain's alert-dialog default) and stops there, as in `NeatDialog`.
 */
@Component({
  selector: 'neat-confirm-dialog',
  imports: [BrnAlertDialogDescription, BrnAlertDialogTitle, NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'alert-dialog-content',
    // Helm's header and footer classes lay out against the content's size, through this attribute.
    'data-size': 'default',
    '[attr.data-state]': 'dialogRef.state()',
    '[class]': 'contentClasses',
  },
  template: `
    <div [class]="classes.header">
      <h2 brnAlertDialogTitle [class]="classes.title">{{ options.title }}</h2>
      <p brnAlertDialogDescription [class]="classes.description">{{ options.message }}</p>
    </div>
    <div [class]="classes.footer">
      <button
        neatButton
        type="button"
        variant="outlined"
        data-neat-confirm-cancel
        (click)="context.answer(false)"
      >
        {{ options.cancelLabel }}
      </button>
      <button
        neatButton
        type="button"
        [variant]="options.tone === 'danger' ? 'danger' : 'primary'"
        (click)="context.answer(true)"
      >
        {{ options.confirmLabel }}
      </button>
    </div>
  `,
})
class NeatConfirmDialog {
  protected readonly dialogRef = inject<BrnDialogRef<boolean>>(BrnDialogRef);
  protected readonly context = injectBrnDialogContext<ConfirmContext>();
  protected readonly options = this.context.options;
  protected readonly classes = CONFIRM_HELM_CLASSES;
  protected readonly contentClasses: string = CONTENT_CLASSES;

  constructor() {
    // The topmost dialog is the only one that gets the key (the CDK's dispatcher), and a modal
    // absorbs it: page shortcuts on Escape (a panel, a drawing mode) must not fire behind the
    // question. The CDK listens on `body`, so this stops it on the way up to `document` and
    // `window`; the CDK still closes the dialog with it.
    inject(DialogRef)
      .keydownEvents.pipe(
        filter((event) => event.key === 'Escape'),
        takeUntilDestroyed(),
      )
      .subscribe((event) => event.stopPropagation());
  }
}

/**
 * Asks the user to confirm an action before the app takes it:
 *
 * ```ts
 * if (await this.confirm.ask({ title: 'Reset all channels to global?', message: '…',
 *     confirmLabel: 'Reset', tone: 'danger' })) {
 *   this.store.resetAllChannels();
 * }
 * ```
 *
 * `ask` shows a modal alert dialog, named by the title and described by the message, with a cancel
 * and a confirm button. It resolves `true` when the confirm button is pressed and `false` on
 * cancel or Escape, once the dialog has closed and focus is back on the element that had it. A
 * click on the backdrop does nothing: the question needs an answer. Focus starts on cancel, the
 * choice that changes nothing, and stays inside the dialog. A `tone: 'danger'` confirm button is
 * the danger `neatButton`, otherwise the primary one.
 *
 * One question at a time: an `ask` while a dialog is open resolves that one `false` and closes it
 * at once, then shows the new one, which gives focus back where the first came from. A dialog
 * still closing after a button press keeps that answer.
 */
@Injectable({ providedIn: 'root' })
export class NeatConfirm {
  private readonly dialogs = inject(BrnDialogService);
  private current: Question | undefined;

  ask(options: NeatConfirmOptions): Promise<boolean> {
    // Closed without its exit animation, so that focus is back on the opener before the next
    // dialog notes where focus was. A button pressed during the animation (brain's `forceClose`
    // replaces the result of a closing dialog too) keeps its answer; an open dialog is cancelled.
    this.current?.dialogRef.forceClose(this.current.answer ?? false);

    const context: ConfirmContext = {
      options: {
        ...options,
        cancelLabel: options.cancelLabel ?? 'Cancel',
        tone: options.tone ?? 'default',
      },
      answer: (confirmed) => {
        question.answer = confirmed;
        dialogRef.close(confirmed);
      },
    };
    const dialogRef = this.dialogs.open<ConfirmContext, boolean>(
      NeatConfirmDialog,
      undefined,
      context,
      DIALOG_OPTIONS,
    );
    const question: Question = { dialogRef };
    this.current = question;
    return new Promise((resolve) => {
      dialogRef.closed$.subscribe((result) => {
        if (this.current === question) this.current = undefined;
        // Escape closes without a result.
        resolve(result === true);
      });
    });
  }
}
