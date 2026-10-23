import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  TemplateRef,
  untracked,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { MAX_VISIBLE_TOASTS, ToastStore, type ToastEntry } from './toast-store';

/** The gap between the stack and the screen's corner. */
const SCREEN_INSET = '1rem';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. Every toast is the popover's surface, outlined in `--border`; an error is outlined and
 * written in the danger colour.
 */
const SURFACE =
  'bg-popover ring-1 rounded-md shadow-md p-3 text-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none';
const NEUTRAL = `${SURFACE} text-popover-foreground ring-border`;
const TOAST_CLASSES: Record<ToastEntry['kind'], string> = {
  status: NEUTRAL,
  progress: NEUTRAL,
  error: `${SURFACE} text-destructive ring-destructive`,
};

/**
 * Shows the app's toasts (`NeatToasts`): render it once, beside the shell, and nowhere else:
 *
 * ```html
 * <neat-shell …>…</neat-shell>
 * <neat-toast-host />
 * ```
 *
 * Not inside the shell: the shell is the kit's primary entry point, which cannot import this one,
 * and an app that shows no toasts should not carry them.
 *
 * The toasts stack in the bottom-right corner, the newest last, at most three at a time (the
 * newest three; an older one is hidden while newer ones push it out and shows again if it is
 * still there when they clear). The stack is a polite live region that exists from the start, so
 * screen readers announce each toast as it appears; a progress toast's changing detail and percent
 * are not live, so a long upload is not read out every second. The progress bar still reports its
 * value to anyone who goes to it.
 *
 * The stack is rendered in the CDK overlay layer rather than where the host stands, for two
 * reasons: a modal dialog hides everything outside that layer from assistive technology, which
 * would silence a toast raised by the dialog's own action, and it must show above the dialog (as
 * #170's toasts showed above its modals). Overlays stack in the order they were last brought to
 * the front, so each new toast brings the stack to the front again: an error raised by a dialog's
 * own action shows above the dialog, though the host is older. A toast that was on screen before
 * a dialog opened stays under the dialog until it clears or a newer toast arrives.
 */
@Component({
  selector: 'neat-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './toast-host.css',
  template: `
    <ng-template #stack>
      <div aria-live="polite" class="flex w-[min(22.5rem,calc(100vw-2rem))] flex-col gap-2">
        @for (toast of visible(); track toast.id) {
          <div data-slot="toast" [attr.data-kind]="toast.kind" [class]="classes[toast.kind]">
            @if (toast.kind === 'progress') {
              <p class="m-0 font-medium">{{ toast.title }}</p>
              <div
                aria-live="off"
                class="text-muted-foreground mt-1 flex justify-between gap-3 text-(length:--neat-text-xs)"
              >
                <span class="truncate" [attr.title]="toast.detail">{{ toast.detail }}</span>
                @if (toast.percent !== null) {
                  <span>{{ toast.percent }}%</span>
                }
              </div>
              <div
                role="progressbar"
                class="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
                [attr.aria-label]="toast.title"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-valuenow]="toast.percent"
                [attr.data-indeterminate]="toast.percent === null ? '' : null"
              >
                <div
                  data-slot="toast-fill"
                  class="fill bg-primary h-full rounded-full"
                  [attr.data-indeterminate]="toast.percent === null ? '' : null"
                  [style.width.%]="toast.percent"
                ></div>
              </div>
            } @else {
              <p class="m-0">
                @if (toast.kind === 'error') {
                  <span class="sr-only">Error: </span>
                }
                {{ toast.message }}
              </p>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class NeatToastHost {
  private readonly store = inject(ToastStore);
  private readonly stack = viewChild.required<TemplateRef<unknown>>('stack');
  private overlayRef: OverlayRef | undefined;
  private newestShown: number | undefined;
  protected readonly classes = TOAST_CLASSES;
  protected readonly visible = computed(() => this.store.entries().slice(-MAX_VISIBLE_TOASTS));

  constructor() {
    const overlay = inject(Overlay);
    const viewContainer = inject(ViewContainerRef);
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const overlayRef = overlay.create({
        positionStrategy: overlay.position().global().bottom(SCREEN_INSET).right(SCREEN_INSET),
      });
      overlayRef.attach(new TemplatePortal(this.stack(), viewContainer));
      this.overlayRef = overlayRef;
      destroyRef.onDestroy(() => overlayRef.dispose());
    });

    effect(() => {
      const newest = this.visible().at(-1)?.id;
      untracked(() => {
        if (newest !== undefined && newest !== this.newestShown) this.bringToFront();
        this.newestShown = newest;
      });
    });
  }

  /**
   * Puts the stack above every overlay that is open. Where the browser has the popover API the
   * CDK shows each overlay as a popover, and the top layer orders them by when they were shown,
   * so showing it again moves it to the top; elsewhere the overlays are siblings in the
   * container, and a later sibling is above an earlier one.
   */
  private bringToFront(): void {
    const host = this.overlayRef?.hostElement;
    if (!host) return;
    if (host.hasAttribute('popover')) {
      host.hidePopover();
      host.showPopover();
    } else {
      host.parentElement?.append(host);
    }
  }
}
