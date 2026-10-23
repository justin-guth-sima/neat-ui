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
import { ToastStore, visibleToasts, type ToastEntry } from './toast-store';

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
 * The toasts stack in the bottom-right corner, the newest last, at most three at a time. When
 * more exist, the oldest error and status toasts are hidden first and the oldest progress toasts
 * last (work in progress is what the user is waiting for); a hidden toast shows again if it is
 * still there when the others clear.
 *
 * What the user sees and what a screen reader announces are two layers. The visible stack is
 * `aria-hidden`. A second overlay, never re-shown and never hidden, holds a visually hidden
 * `aria-live="polite"` region with one entry per toast: the message ("Error: " in front of an
 * error), or a progress toast's title. An entry is added when its toast is, so each toast is
 * announced once, as it appears. A progress toast's changing detail and percent are in a nested
 * `aria-live="off"` part: a screen reader finds the current value when it reads the region, but a
 * long upload is not read out every second. The two layers are separate because bringing the
 * stack to the front (below) hides and shows it, which takes a live region out of the
 * accessibility tree and back with its content already in it, and that is not announced.
 *
 * Both layers are rendered in the CDK overlay layer rather than where the host stands, for two
 * reasons: a modal dialog hides everything outside that layer from assistive technology, which
 * would silence a toast raised by the dialog's own action, and the stack must show above the
 * dialog (as #170's toasts showed above its modals). Overlays stack in the order they were last
 * brought to the front, so each new toast brings the stack to the front again: an error raised by
 * a dialog's own action shows above the dialog, though the host is older. A toast that was on
 * screen before a dialog opened stays under the dialog until it clears or a newer toast arrives.
 *
 * The stack takes no pointer events: it has nothing to click, and a progress toast that stays for
 * as long as an upload runs must not sit on a dialog's buttons. Clicks pass through to whatever is
 * under a toast; the cost is that toast text cannot be selected.
 */
@Component({
  selector: 'neat-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './toast-host.css',
  template: `
    <ng-template #announcer>
      <div aria-live="polite" class="sr-only" data-slot="toast-announcer">
        @for (toast of announced(); track toast.id) {
          <div data-slot="toast-announcement">
            @if (toast.kind === 'progress') {
              {{ toast.title }}
              <span aria-live="off">
                {{ toast.detail }}
                @if (toast.percent !== null) {
                  {{ toast.percent }}%
                }
              </span>
            } @else {
              @if (toast.kind === 'error') {
                Error:
              }
              {{ toast.message }}
            }
          </div>
        }
      </div>
    </ng-template>
    <ng-template #stack>
      <div aria-hidden="true" class="flex w-[min(22.5rem,calc(100vw-2rem))] flex-col gap-2">
        @for (toast of visible(); track toast.id) {
          <div data-slot="toast" [attr.data-kind]="toast.kind" [class]="classes[toast.kind]">
            @if (toast.kind === 'progress') {
              <p class="m-0 font-medium">{{ toast.title }}</p>
              <div
                class="text-muted-foreground mt-1 flex justify-between gap-3 text-(length:--neat-text-xs)"
              >
                <span class="truncate" [attr.title]="toast.detail">{{ toast.detail }}</span>
                @if (toast.percent !== null) {
                  <span>{{ toast.percent }}%</span>
                }
              </div>
              <div
                data-slot="toast-track"
                class="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
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
              <p class="m-0">{{ toast.message }}</p>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class NeatToastHost {
  private readonly store = inject(ToastStore);
  private readonly announcer = viewChild.required<TemplateRef<unknown>>('announcer');
  private readonly stack = viewChild.required<TemplateRef<unknown>>('stack');
  private stackOverlay: OverlayRef | undefined;
  private newestShown = 0;
  protected readonly classes = TOAST_CLASSES;
  /** Every toast there is: an entry is announced when it appears, whether it is on screen or not. */
  protected readonly announced = this.store.entries;
  protected readonly visible = computed(() => visibleToasts(this.store.entries()));

  constructor() {
    const overlay = inject(Overlay);
    const viewContainer = inject(ViewContainerRef);
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const announcement = overlay.create({ positionStrategy: overlay.position().global() });
      announcement.attach(new TemplatePortal(this.announcer(), viewContainer));
      const stack = overlay.create({
        positionStrategy: overlay.position().global().bottom(SCREEN_INSET).right(SCREEN_INSET),
      });
      stack.attach(new TemplatePortal(this.stack(), viewContainer));
      for (const layer of [announcement, stack]) {
        // CDK's own rule gives a pane `pointer-events: auto`, which a class cannot outweigh.
        layer.overlayElement.style.pointerEvents = 'none';
      }
      this.stackOverlay = stack;
      destroyRef.onDestroy(() => {
        announcement.dispose();
        stack.dispose();
      });
    });

    effect(() => {
      // Ids only grow, so a toast was added when the newest id is larger than any seen. A toast
      // that clears makes the newest id smaller, and the stack stays where it is.
      const newest = this.store.entries().at(-1)?.id ?? 0;
      untracked(() => {
        if (newest > this.newestShown) {
          this.newestShown = newest;
          this.bringToFront();
        }
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
    const host = this.stackOverlay?.hostElement;
    if (!host) return;
    if (host.hasAttribute('popover')) {
      host.hidePopover();
      host.showPopover();
    } else {
      host.parentElement?.append(host);
    }
  }
}
