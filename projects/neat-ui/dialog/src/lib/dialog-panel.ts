import {
  CdkPortalOutlet,
  type CdkPortalOutletAttachedRef,
  ComponentPortal,
  TemplatePortal,
} from '@angular/cdk/portal';
import { DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  inject,
  Injector,
  TemplateRef,
  Type,
  ViewContainerRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BrnDialogRef, BrnDialogTitle, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { filter } from 'rxjs';
import { NeatButton, NeatIcon, ɵhlm as hlm } from '@sima/neat-ui';
import { NeatDialogRef } from './dialog-ref';

/** How wide the dialog is on screens wider than a phone: 24, 32 and 48 rem. */
export type NeatDialogSize = 'small' | 'medium' | 'large';

/**
 * Helm's dialog classes (`lib/ui/dialog`), copied because helm keeps them inline. dialog.spec
 * checks that each string still appears in the vendored helm, so a helm update that changes one
 * fails until this table is reviewed.
 */
export const DIALOG_HELM_CLASSES = {
  /** `hlm-dialog-content.ts`: the panel. */
  content:
    'bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 grid max-w-[calc(100%-2rem)] gap-6 rounded-xl p-6 text-sm ring-1 duration-100 sm:max-w-md relative mx-auto w-full outline-none sm:mx-0',
  /** `hlm-dialog-content.ts`: where the close button sits, in the panel's corner. */
  closeButton: 'absolute end-4 top-4',
  /** `hlm-dialog-header.ts`: the title's row. */
  header: 'gap-2 flex flex-col',
  /** `hlm-dialog-title.ts`. */
  title: 'leading-none font-medium',
  /** `hlm-dialog-footer.ts`: the buttons, stacked on narrow screens. */
  footer: 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
  /** `hlm-dialog-overlay.ts`: the backdrop over the page. */
  overlay:
    'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 isolate bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs',
} as const;

/**
 * What the panel adds to helm's, as one merge (tailwind-merge drops the helm class each one
 * replaces):
 * - the outline in `--border`, where helm draws the text colour at 10%, as the popover's panel is;
 * - a column of flex items instead of a grid, so that the body can shrink and scroll between the
 *   title and the actions, within the height of the screen;
 * - the width: helm's `sm:max-w-md` cap becomes the screen's width less the margins, and the size
 *   sets the width up to it. Below `sm` the panel is as wide as the screen allows, as helm's is.
 */
const PANEL_CLASSES = hlm(
  DIALOG_HELM_CLASSES.content,
  'ring-border flex flex-col max-h-[calc(100dvh-2rem)] sm:max-w-[calc(100%-2rem)]',
);

/** Each size's width, written out in full: Tailwind reads class names, it cannot build them. */
const SIZE_CLASSES: Record<NeatDialogSize, string> = {
  small: 'sm:w-sm',
  medium: 'sm:w-lg',
  large: 'sm:w-3xl',
};

/** What `NeatDialog` hands the panel through the brain dialog's context. */
export interface DialogContext {
  readonly title: string;
  readonly size: NeatDialogSize;
  readonly content: TemplateRef<unknown> | Type<unknown>;
  readonly ref: NeatDialogRef;
}

/**
 * The dialog's frame, rendered by `NeatDialog` inside the CDK dialog container, which carries the
 * role, the modal state and the focus trap: the title, the content the app gave, and the close
 * button, which stays (marked `aria-disabled`) while the dialog is not dismissible, so that focus
 * on it is not lost when the dialog turns busy.
 *
 * Closing from outside is the kit's rather than brain's: brain reads "may this close" once, when
 * the dialog opens, and `setDismissible` changes it later. The dialog opens with brain's closing
 * switched off, and the panel closes it on Escape and a backdrop click while `ref.dismissible()`.
 */
@Component({
  selector: 'neat-dialog-panel',
  imports: [BrnDialogTitle, CdkPortalOutlet, NeatButton, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'dialog-content',
    '[attr.data-state]': 'brain.state()',
    '[class]': 'panelClasses',
  },
  template: `
    <div [class]="classes.header">
      <h2 brnDialogTitle [class]="classes.title">{{ context.title }}</h2>
    </div>
    <ng-container [cdkPortalOutlet]="content" (attached)="laidOutWithThePanel($event)" />
    <button
      neatButton
      type="button"
      variant="text"
      size="small"
      iconOnly
      aria-label="Close"
      [attr.aria-disabled]="ref.dismissible() ? null : 'true'"
      [class]="closeButtonClasses"
      (click)="dismiss()"
    >
      <neat-icon name="close" [size]="16" />
    </button>
  `,
})
export class NeatDialogPanel {
  protected readonly brain = inject<BrnDialogRef>(BrnDialogRef);
  protected readonly context = injectBrnDialogContext<DialogContext>();
  protected readonly ref = this.context.ref;
  protected readonly classes = DIALOG_HELM_CLASSES;
  protected readonly panelClasses: string = hlm(PANEL_CLASSES, SIZE_CLASSES[this.context.size]);
  /**
   * Helm's corner position; while the dialog is not dismissible the button is dimmed, not removed
   * or `disabled`: a button that has focus loses it when it goes, and the trap only works from
   * inside the dialog, so the next Tab would leave for the page behind.
   */
  protected readonly closeButtonClasses = `${DIALOG_HELM_CLASSES.closeButton} aria-disabled:opacity-50 aria-disabled:cursor-not-allowed`;
  protected readonly content: ComponentPortal<unknown> | TemplatePortal<unknown>;

  constructor() {
    const injector = inject(Injector);
    const content = this.context.content;
    this.content =
      content instanceof TemplateRef
        ? new TemplatePortal(content, inject(ViewContainerRef), { $implicit: this.ref })
        : new ComponentPortal(
            content,
            null,
            Injector.create({
              providers: [{ provide: NeatDialogRef, useValue: this.ref }],
              parent: injector,
            }),
          );

    const cdkRef = inject(DialogRef);
    cdkRef.backdropClick.pipe(takeUntilDestroyed()).subscribe(() => this.dismiss());
    cdkRef.keydownEvents
      .pipe(
        filter((event) => event.key === 'Escape'),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        // The topmost dialog is the only one that gets the key (the CDK's dispatcher), and a modal
        // absorbs it whether or not it closes: page shortcuts on Escape (a panel, a drawing
        // mode) must not fire behind a dialog, busy or not. The CDK listens on `body`, so this
        // stops it on the way up to `document` and `window`.
        event.stopPropagation();
        if (this.dismiss()) event.preventDefault();
      });
  }

  /** Closes the dialog if it may be closed from outside; returns whether it did. */
  protected dismiss(): boolean {
    if (!this.ref.dismissible()) return false;
    this.ref.close();
    return true;
  }

  /**
   * A component's own element is the panel's flex item otherwise, and its body and actions would
   * sit inside it, out of the panel's flex column: no gap between them and no scrolling body.
   * `display: contents` takes the element out of the layout so that they are the panel's items.
   * It is set inline, where the content's own `:host { display: block }` (unlayered component CSS,
   * which beats any Tailwind utility) cannot undo it.
   */
  protected laidOutWithThePanel(attached: CdkPortalOutletAttachedRef): void {
    if (attached instanceof ComponentRef) {
      (attached.location.nativeElement as HTMLElement).style.display = 'contents';
    }
  }
}
