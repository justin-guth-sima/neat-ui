import { InteractivityChecker } from '@angular/cdk/a11y';
import { afterRenderEffect, Directive, DOCUMENT, ElementRef, inject, model } from '@angular/core';
import { tabbablesIn } from '../overlay/overlay-focus';

/**
 * Shows its host over the whole browser window, and puts it back: a video tile, a card or a 3D
 * view, made large for a closer look.
 *
 * ```html
 * <neat-card title="Detections" neatExpand #expand="neatExpand">
 *   <button neatButton neatCardActions type="button" (click)="expand.toggle()">
 *     {{ expand.expanded() ? 'Close' : 'Expand' }}
 *   </button>
 *   …
 * </neat-card>
 * ```
 *
 * It is the same element, not a copy, so what it shows keeps running: a video plays on, and a
 * chart or a canvas takes the new size as it would any other. It covers the window, not the
 * screen: the browser's own full screen is not used.
 *
 * Put the button that closes it inside the host. The host covers the page, so a button outside it
 * is covered too. Escape closes it as well.
 *
 * How it looks:
 *
 * - The host fills the window, edge to edge, with no rounded corners. It is lifted into the
 *   browser's top layer (the Popover API), so no container of the page clips it or paints over it.
 * - Its own fill, padding and text color stay. A host without a fill or a text color takes the
 *   page's.
 * - Content taller than the window scrolls inside the host.
 *
 * The keyboard:
 *
 * - Opening moves the focus into the host when it is outside, such as on a button that opened it
 *   from elsewhere.
 * - Tab and Shift+Tab go round the host's controls, never to the covered page.
 * - Escape closes it, unless a control inside handled the key first, such as an open select.
 * - Closing puts the focus back where it was before opening, when it was inside the host.
 *
 * Overlays opened from inside it, such as a tooltip, a popover, a select's list or a dialog, show
 * above it. A toast shown while it is open does too.
 *
 * `expanded` is a model, so the app can open it from its own state and follow it:
 * `[(expanded)]="large"`.
 */
@Directive({
  selector: '[neatExpand]',
  exportAs: 'neatExpand',
  host: {
    '[attr.data-neat-expanded]': 'expanded() ? "" : null',
    '(keydown)': 'onKeydown($event)',
    '(toggle)': 'onToggle($event)',
  },
})
export class NeatExpand {
  /** Whether the host is shown over the whole window. */
  readonly expanded = model(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly interactivity = inject(InteractivityChecker);
  /** Whether the host is shown over the window now, which `expanded` leads by a render. */
  private shown = false;
  /** Where the focus was when the host opened, to go back to when it closes. */
  private returnFocus: HTMLElement | null = null;
  /** The host had no tabindex, so it got one for the focus to land on while open. */
  private addedTabIndex = false;

  constructor() {
    // After render, so the host's look (its data attribute) is in place when it enters the top
    // layer, and before the browser paints it.
    afterRenderEffect(() => this.show(this.expanded()));
  }

  /** Shows the host over the whole window. */
  open(): void {
    this.expanded.set(true);
  }

  /** Puts the host back in its place on the page. */
  close(): void {
    this.expanded.set(false);
  }

  /** Opens the host when it is in its place, and closes it when it is open. */
  toggle(): void {
    this.expanded.update((expanded) => !expanded);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.expanded() || event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      // Handled here, so a shortcut of the page or a dialog around the host does not see it too.
      event.stopPropagation();
      this.close();
    } else if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      this.keepTabInside(event);
    }
  }

  /** The browser took the host out of the top layer (the app called `hidePopover`, say). */
  protected onToggle(event: Event): void {
    if (event.target === this.host && (event as ToggleEvent).newState === 'closed') {
      this.close();
    }
  }

  private show(expanded: boolean): void {
    if (expanded === this.shown) return;
    this.shown = expanded;
    const host = this.host;
    // Without the Popover API (an old browser, a test DOM) the state still changes, but the host
    // stays in its place: its look applies to an open popover only.
    const popover = typeof host.showPopover === 'function';
    if (expanded) {
      const active = this.document.activeElement;
      this.returnFocus = active instanceof HTMLElement ? active : null;
      this.addedTabIndex = !host.hasAttribute('tabindex');
      if (this.addedTabIndex) host.setAttribute('tabindex', '-1');
      if (popover) {
        // Manual, not auto: an auto popover closes on a click outside it, and a click in an
        // overlay opened from inside the host (a select's list, a dialog) is outside it.
        host.setAttribute('popover', 'manual');
        host.showPopover();
      }
      if (!host.contains(this.document.activeElement)) host.focus({ preventScroll: true });
    } else {
      const active = this.document.activeElement;
      const focusInside = active === null || active === this.document.body || host.contains(active);
      if (popover && host.hasAttribute('popover')) {
        host.hidePopover();
        host.removeAttribute('popover');
      }
      if (this.addedTabIndex) host.removeAttribute('tabindex');
      if (focusInside && this.returnFocus?.isConnected) this.returnFocus.focus();
      this.returnFocus = null;
    }
  }

  /** Tab from the last control goes to the first, Shift+Tab from the first to the last. */
  private keepTabInside(event: KeyboardEvent): void {
    const tabbables = tabbablesIn(this.document, this.interactivity, this.host);
    const first = tabbables[0];
    const last = tabbables.at(-1);
    if (first === undefined || last === undefined) {
      event.preventDefault();
    } else if (event.shiftKey && (event.target === first || event.target === this.host)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
