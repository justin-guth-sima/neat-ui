import { InteractivityChecker } from '@angular/cdk/a11y';
import { OverlayContainer } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';

/**
 * The focus rules of a panel opened from a trigger and rendered in CDK's overlay container, at the
 * end of the document: `neat-popover` and the collapsed rail's menu share them, through
 * `ɵOverlayFocus`, so there is one place for them. Internal to the kit; create it in an injection
 * context.
 *
 * The browser's Tab order does not pass from the trigger through such a panel, so the kit carries
 * it across by hand (`carryTabOrder`), and closes the panel when focus lands anywhere outside the
 * trigger and the panel (`watchOutsideFocus`).
 */
export class OverlayFocus {
  private readonly overlayContainer = inject(OverlayContainer);
  private readonly interactivity = inject(InteractivityChecker);
  private readonly document = inject(DOCUMENT);

  /**
   * @param trigger The element the panel opened from, which holds the Tab order's place.
   * @param close Puts the panel away.
   */
  constructor(
    private readonly trigger: () => HTMLElement,
    private readonly close: () => void,
  ) {}

  /**
   * Carries the Tab order across `panel`: Tab from its last tabbable control would leave the
   * document, and Shift+Tab from its first would land on the last control of the page. So both
   * close the panel and move focus where it would go if the panel sat after the trigger: the first
   * tabbable after the trigger, or the trigger itself. With nothing tabbable after the trigger, the
   * browser's own Tab is left to run.
   */
  carryTabOrder(event: KeyboardEvent, panel: HTMLElement): void {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const tabbables = this.tabbablesIn(panel);
    if (event.shiftKey && event.target === tabbables[0]) {
      event.preventDefault();
      this.close();
      this.trigger().focus();
    } else if (!event.shiftKey && event.target === tabbables.at(-1)) {
      const next = this.tabbableAfterTrigger();
      if (next) {
        event.preventDefault();
        next.focus();
      }
      this.close();
    }
  }

  /**
   * A safety net for every way focus can arrive outside the panel. It listens for where focus
   * lands, not where it left: Tab from the panel's last control can leave the document, and focus
   * then comes back on the page's first element with no `focusout` naming it. A `focusout` with
   * no target (another window took focus) is not a move, so it is deliberately not heard. Returns
   * what stops listening.
   */
  watchOutsideFocus(): () => void {
    const closeOnOutsideFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !this.holdsFocus(event.target)) {
        this.close();
      }
    };
    this.document.addEventListener('focusin', closeOnOutsideFocus);
    return () => this.document.removeEventListener('focusin', closeOnOutsideFocus);
  }

  /**
   * Whether focus on `node` leaves the panel as it is: the trigger, and CDK's overlay container.
   * The container holds the panel and every other overlay, apart from the panel's own DOM, so an
   * element's ancestry cannot tell an overlay opened from the panel (a `NeatConfirm`) from any
   * other. None takes focus on its own while the panel is open, and another trigger lies outside
   * the container, so the container is the narrowest test that keeps the dialogs a panel's
   * controls open.
   */
  holdsFocus(node: Node): boolean {
    return (
      this.trigger().contains(node) || this.overlayContainer.getContainerElement().contains(node)
    );
  }

  /**
   * Moves focus to the first enabled control under `panel`. CDK's `isTabbable` only reads
   * `tabIndex`, which a disabled button has too, so a disabled control is skipped here and in every
   * walk of this class. With none, the focus stays where it is.
   */
  focusFirstControl(panel: HTMLElement | null): void {
    if (panel) {
      this.tabbablesIn(panel)[0]?.focus();
    }
  }

  /**
   * The tabbable elements under `root` in document order (the module's `tabbablesIn`). The overlay
   * container's subtree is left out when `root` holds it.
   */
  tabbablesIn(root: Node): HTMLElement[] {
    return tabbablesIn(
      this.document,
      this.interactivity,
      root,
      this.overlayContainer.getContainerElement(),
    );
  }

  /** The first tabbable element after the trigger in the page, outside the overlay container. */
  private tabbableAfterTrigger(): HTMLElement | null {
    const walker = tabbableWalker(
      this.document,
      this.interactivity,
      this.document.body,
      this.overlayContainer.getContainerElement(),
    );
    walker.currentNode = this.trigger();
    return walker.nextNode() as HTMLElement | null;
  }
}

/**
 * The tabbable elements under `root` in document order, leaving out `excluded`'s subtree. They are
 * judged by CDK's `InteractivityChecker`, which knows tabindex and the elements a selector list
 * would get wrong; a disabled control is skipped, which CDK's `isTabbable` counts, and so is an
 * element the browser does not draw (`display: none` on it or an ancestor, such as the collapsed
 * rail's sub-page rows, or `visibility: hidden`), which `isTabbable` does not check and Tab skips.
 * `OverlayFocus` and `NeatExpand`'s Tab order share it.
 */
export function tabbablesIn(
  document: Document,
  interactivity: InteractivityChecker,
  root: Node,
  excluded: Element | null = null,
): HTMLElement[] {
  const walker = tabbableWalker(document, interactivity, root, excluded);
  const found: HTMLElement[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    found.push(node as HTMLElement);
  }
  return found;
}

/** A walker over `root`'s tabbable elements that does not enter `excluded`. */
function tabbableWalker(
  document: Document,
  interactivity: InteractivityChecker,
  root: Node,
  excluded: Element | null,
): TreeWalker {
  return document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, (node) => {
    if (node === excluded) {
      return NodeFilter.FILTER_REJECT;
    }
    const element = node as HTMLElement;
    return interactivity.isTabbable(element) && !interactivity.isDisabled(element) && drawn(element)
      ? NodeFilter.FILTER_ACCEPT
      : NodeFilter.FILTER_SKIP;
  });
}

/**
 * Whether the browser draws `element`: not under `display: none` and not `visibility: hidden`
 * (`checkVisibility()`, asked for the visibility property too, which a browser that does not know
 * the option ignores). A document without the method (jsdom) draws everything, as it lays nothing
 * out.
 */
function drawn(element: HTMLElement): boolean {
  return (
    typeof element.checkVisibility !== 'function' ||
    element.checkVisibility({ visibilityProperty: true })
  );
}
