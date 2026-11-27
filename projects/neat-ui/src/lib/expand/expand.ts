import { InteractivityChecker } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  DestroyRef,
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  isDevMode,
  model,
  NgZone,
} from '@angular/core';
import { tabbablesIn } from '../overlay/overlay-focus';
import { PAGE_BODY_AREA, SHELL_CONTENT_AREA } from './expand-area';
import { clearRegion, regionBox, trackRegion } from './region-tracker';

/**
 * What an expanded element covers (`NeatExpand`'s `region`):
 *
 * - `window`: the whole browser window.
 * - `content`: the shell's content area, below the top bar and beside the rail, with the page's
 *   aside under it.
 * - `body`: the page's body, beside its aside and its page nav.
 * - an element: that element's box, such as a card around the element.
 */
export type NeatExpandRegion = 'window' | 'content' | 'body' | HTMLElement;

/** On the host while it covers a region other than the window, for `expand.css`. */
const REGION_ATTRIBUTE = 'data-neat-expand-region';

/**
 * Shows its host over the whole browser window, or over a part of the page, and puts it back: a
 * video tile, a card or a 3D view, made large for a closer look.
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
 * **What it covers.** `region` (a `NeatExpandRegion`) says what the host covers while expanded:
 *
 * - `window` (the default): the whole browser window.
 * - `content`: the shell's content area. The rail and the top bar stay in view and usable, so a
 *   rail item still navigates, and the page goes with its host. The page's aside is covered.
 * - `body`: the page's body. The aside and the page nav stay beside it.
 * - an element of the app's, such as a card around the host: that element's box.
 *
 * ```html
 * <neat-video-tile [source]="camera" label="Camera 1" expandControl region="body" />
 * ```
 *
 * The host follows its region as it moves or resizes: a resized window, an aside that opens, a box
 * that scrolls it. In kiosk mode the content area and the body are what shows of them, so `content`
 * is the whole window there. Outside a `neat-shell`, `content` covers the window, and outside a
 * `neat-page`, `body` does; each is said once in dev mode.
 *
 * An element the app names must show while the host covers it. It closes the host when it leaves
 * the page or shows nothing (hidden, or no width or no height), and the host does not open over
 * one that shows nothing. An element that holds the host and takes its size from it shrinks when
 * the host leaves its place, so give such an element a size of its own, such as a grid cell's.
 *
 * How it looks:
 *
 * - The host fills its region, edge to edge: the window with no rounded corners, an element with
 *   that element's. It is lifted into the browser's top layer (the Popover API), so no container
 *   of the page clips it or paints over it.
 * - Its own fill, padding and text color stay. A host without a fill or a text color takes the
 *   page's.
 * - Content taller than its region scrolls inside the host.
 *
 * The keyboard, in every region:
 *
 * - Opening moves the focus into the host when it is outside, such as on a button that opened it
 *   from elsewhere.
 * - Tab and Shift+Tab go round the host's controls, never to the covered page.
 * - Escape closes it, unless a control inside handled the key first, such as an open select.
 * - Closing puts the focus back where it was before opening, when it was inside the host. So does
 *   the host going from the page while expanded, when that place is still in it.
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
  /** Whether the host is shown over its region. */
  readonly expanded = model(false);
  /**
   * What the host covers while expanded: `window` (the default), `content` (the shell's content
   * area), `body` (the page's body) or an element of the app's. It may change while expanded.
   */
  readonly region = input<NeatExpandRegion>('window');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly interactivity = inject(InteractivityChecker);
  private readonly zone = inject(NgZone);
  private readonly contentArea = inject(SHELL_CONTENT_AREA, { optional: true });
  private readonly bodyArea = inject(PAGE_BODY_AREA, { optional: true });
  /** Whether the host is shown over its region now, which `expanded` leads by a render. */
  private shown = false;
  /** Where the focus was when the host opened, to go back to when it closes. */
  private returnFocus: HTMLElement | null = null;
  /** The host had no tabindex, so it got one for the focus to land on while open. */
  private addedTabIndex = false;
  /** Stops following the region the host covers; null over the window. */
  private stopTracking: (() => void) | null = null;
  /** The regions said in dev mode to cover the window here, each said once. */
  private readonly warned = new Set<'content' | 'body'>();

  constructor() {
    // After render, so the host's look (its data attribute) is in place when it enters the top
    // layer, and before the browser paints it.
    afterRenderEffect(() => this.show(this.expanded(), this.region()));
    inject(DestroyRef).onDestroy(() => this.leave());
  }

  /** Shows the host over its region. */
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

  private show(expanded: boolean, region: NeatExpandRegion): void {
    if (!expanded) {
      if (this.shown) this.hide();
      return;
    }
    const area = this.areaOf(region);
    if (this.shown) {
      // The region changed while the host covers it.
      if (!this.cover(area)) this.close();
      return;
    }
    // An element that shows nothing has nothing to cover: the host stays in its place.
    if (!this.cover(area)) {
      this.close();
      return;
    }
    this.shown = true;
    const host = this.host;
    const active = this.document.activeElement;
    this.returnFocus = active instanceof HTMLElement ? active : null;
    this.addedTabIndex = !host.hasAttribute('tabindex');
    if (this.addedTabIndex) host.setAttribute('tabindex', '-1');
    // Without the Popover API (an old browser, a test DOM) the state still changes, but the host
    // stays in its place: its look applies to an open popover only.
    if (typeof host.showPopover === 'function') {
      // Manual, not auto: an auto popover closes on a click outside it, and a click in an
      // overlay opened from inside the host (a select's list, a dialog) is outside it.
      host.setAttribute('popover', 'manual');
      host.showPopover();
    }
    if (!host.contains(this.document.activeElement)) host.focus({ preventScroll: true });
  }

  private hide(): void {
    this.shown = false;
    const host = this.host;
    const focusInside = this.focusInside();
    if (typeof host.hidePopover === 'function' && host.hasAttribute('popover')) {
      // A host taken out of the document has left the top layer with it.
      if (host.isConnected) host.hidePopover();
      host.removeAttribute('popover');
    }
    this.cover(null);
    if (this.addedTabIndex) host.removeAttribute('tabindex');
    this.giveFocusBack(focusInside);
  }

  /** The host goes from the page while expanded: the focus goes back as on closing. */
  private leave(): void {
    this.stopTracking?.();
    this.stopTracking = null;
    if (this.shown) this.giveFocusBack(this.focusInside());
  }

  /** Whether the focus is in the host, or nowhere (on the document's body), as after a removal. */
  private focusInside(): boolean {
    const active = this.document.activeElement;
    return active === null || active === this.document.body || this.host.contains(active);
  }

  /** Puts the focus back where it was before opening, if it was `inside` and that is in the page. */
  private giveFocusBack(inside: boolean): void {
    if (inside && this.returnFocus?.isConnected) this.returnFocus.focus();
    this.returnFocus = null;
  }

  /**
   * Places the host over `area`, following it, or over the window for null. False when the area
   * shows nothing, which leaves the host where it was.
   */
  private cover(area: HTMLElement | null): boolean {
    if (area !== null && regionBox(area) === null) return false;
    this.stopTracking?.();
    this.stopTracking = null;
    const host = this.host;
    if (area === null) {
      host.removeAttribute(REGION_ATTRIBUTE);
      clearRegion(host);
      return true;
    }
    host.setAttribute(REGION_ATTRIBUTE, '');
    // Measured outside Angular, every frame something moves; only an area gone comes back in.
    this.stopTracking = this.zone.runOutsideAngular(() =>
      trackRegion(area, host, () => this.zone.run(() => this.close())),
    );
    return true;
  }

  /** The element `region` names, or null for the window. */
  private areaOf(region: NeatExpandRegion): HTMLElement | null {
    if (region === 'window') return null;
    if (region !== 'content' && region !== 'body') return region;
    const area = (region === 'content' ? this.contentArea : this.bodyArea)?.element();
    if (area) return area;
    if (isDevMode() && !this.warned.has(region)) {
      this.warned.add(region);
      const part = region === 'content' ? 'neat-shell' : 'neat-page';
      console.warn(`neatExpand: region "${region}" covers the window here, outside a ${part}`);
    }
    return null;
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
