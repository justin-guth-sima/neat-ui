import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  ComponentRef,
  inject,
  Injectable,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { OverlayFocus } from '../overlay/overlay-focus';
import { PANEL_SURFACE_CLASSES } from '../overlay/panel-surface';
import { hlm } from '../ui/utils/src';
import { NeatNavChild, NeatNavItem } from './nav-item';
import { NeatRailItem, RAIL_ITEM_HAS_MENU, RailState } from './rail-item';

/** The space between the sidebar's edge and the menu, so its outline does not touch the sidebar. */
const RAIL_GAP = 4;

/**
 * How long a menu outlives the pointer's leaving, so that the pointer can cross
 * the rail's padding and the gap to the menu. The tooltip it replaces hides at once, but it has
 * nothing to reach.
 */
const HOVER_CLOSE_DELAY = 150;

/**
 * Which rail menu is open, which is at most one: the menus share it, so that a menu opening puts
 * the open one away at once, with no delay (the delay is for the pointer reaching its own panel,
 * not for a neighbor). Internal to the kit.
 */
@Injectable({ providedIn: 'root' })
class OpenRailMenu {
  private open: { close(): void } | undefined;

  /** Makes `menu` the open one, closing the one that was. */
  claim(menu: { close(): void }): void {
    const previous = this.open;
    this.open = menu;
    if (previous && previous !== menu) {
      previous.close();
    }
  }

  /** `menu` is closed; it is no longer the open one. */
  release(menu: { close(): void }): void {
    if (this.open === menu) {
      this.open = undefined;
    }
  }
}

/** The menu's rows are rail items on a rail that shows its labels, whatever the real one does. */
const LABELED_RAIL = { expanded: signal(true), collapseWhenNarrow: () => undefined };

/** Numbers each menu, for the id its heading gives it as a name. */
let nextMenuId = 0;

/**
 * The menu of a collapsed rail item with sub-pages: the page's name as a heading, then one link
 * per sub-page with the open one marked. A group named by its heading, so a screen reader gets a
 * list of links named by the page. Not a dialog: nothing opens it by a press any more, it is a
 * companion that hover and focus show, and the item that shows it points at it with
 * `aria-controls` (see `RailMenu`). On the shared panel surface, and its rows are the
 * rail's own sub-page rows (`neatRailItem` in its `data-child` variant), so their look is helm's
 * menu sub button (`MENU_SUB_BUTTON_HELM_CLASSES`), stated once. Internal to the kit: `RailMenu`
 * opens it.
 */
@Component({
  selector: 'neat-rail-menu-panel',
  imports: [NeatRailItem, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[id]': 'panelId',
    '[class]': 'panelClasses',
    '[attr.aria-labelledby]': 'headingId',
  },
  template: `
    <h2 class="m-0 px-2.5 pt-1 pb-2 text-sm font-medium text-muted-foreground" [id]="headingId">
      {{ page().label }}
    </h2>
    <ul class="m-0 flex list-none flex-col gap-1 p-0">
      @for (child of page().children; track child.path) {
        <li>
          <!-- The row's text is the item's own label, which the rule cannot see. -->
          <!-- eslint-disable-next-line @angular-eslint/template/elements-content -->
          <a
            neatRailItem
            data-child
            [label]="child.label"
            [routerLink]="child.path"
            [attr.aria-current]="child === current() ? 'page' : null"
            (click)="chosen.emit()"
          ></a>
        </li>
      }
    </ul>
  `,
})
export class RailMenuPanel {
  readonly page = input.required<NeatNavItem>();
  readonly current = input<NeatNavChild>();
  /** A link was followed, which puts the menu away. */
  readonly chosen = output<void>();
  private readonly menuId = ++nextMenuId;
  /** The panel's id, which the item points at with `aria-controls`. */
  readonly panelId = `neat-rail-menu-panel-${this.menuId}`;
  protected readonly headingId = `neat-rail-menu-${this.menuId}`;
  protected readonly panelClasses = hlm(PANEL_SURFACE_CLASSES, 'w-auto min-w-48 gap-0 p-2');
}

/**
 * Gives a collapsed rail link whose page has sub-pages a menu of them beside the rail:
 * `<a neatRailItem [routerLink]="page.path" [neatRailMenu]="page" [neatRailMenuCurrent]="child">`.
 * The item stays a plain link to the page's `path` (the app's routes decide which sub-page that
 * shows): a press (click, tap, Enter, Space) navigates like any rail item, with a link's modified
 * clicks (Ctrl/Cmd/middle) as the router link gives them, and puts the menu away if it is up. The
 * menu is a companion of hover and keyboard focus, never of a press: a mouse or pen hovering shows
 * it, and it closes `HOVER_CLOSE_DELAY` after the pointer leaves both the item and the menu
 * (the delay lets the pointer reach the menu; another item's menu opening closes it at once, as
 * at most one menu is open);
 * keyboard focus on the item (`:focus-visible`, as the tooltip shows on focus) shows it, and it
 * closes when focus leaves both. There is no touch path: a tap navigates and the menu stays shut,
 * since the rail can be expanded to reach the sub-pages. The current sub-page it marks follows the
 * route. It replaces the item's tooltip (`NeatRailItem` switches that off), as the menu's heading
 * says what the tooltip would.
 *
 * Accessibility: the item does not control a popup by a press, so it has no `aria-haspopup` or
 * `aria-expanded`. The menu is a group labeled by its heading, and the item `aria-controls` it
 * while it is shown. The tooltip's `aria-describedby` does not fit, as a description is read as
 * text and cannot hold links; a labeled group of links the item points at keeps them reachable,
 * and Tab from the item steps into them.
 *
 * On CDK's overlay, not brain's popover, whose positions open below its trigger where this menu
 * opens beside the rail. CDK gives the placement, Escape and outside presses; the focus rules are
 * `OverlayFocus`'s, shared with `neat-popover`: Tab from the item goes to the first link; Tab from
 * the last link and Shift+Tab from the first leave the menu as `neat-popover` does; focus landing
 * elsewhere closes it. Escape closes it and returns focus to the item, unless focus has already
 * moved elsewhere (and the menu stays shut until focus comes back or the pointer re-enters); a
 * press outside closes it and leaves focus where the press put it.
 */
@Directive({
  selector: 'a[neatRailItem][neatRailMenu]',
  providers: [{ provide: RAIL_ITEM_HAS_MENU, useValue: true }],
  host: {
    '[attr.aria-controls]': 'controls()',
    '(click)': 'pressed()',
    '(focus)': 'focused()',
    '(pointerenter)': 'hovered($event)',
    '(pointerleave)': 'left($event)',
  },
})
export class RailMenu {
  /** The page whose sub-pages the menu lists. */
  readonly neatRailMenu = input.required<NeatNavItem>();
  /** The page's open sub-page, which the menu marks. */
  readonly neatRailMenuCurrent = input<NeatNavChild | undefined>();

  /** The id of the menu while it is shown, for `aria-controls`. */
  protected readonly controls = signal<string | null>(null);
  private readonly element: HTMLAnchorElement = inject(ElementRef).nativeElement;
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private readonly openMenu = inject(OpenRailMenu);
  private readonly focus = new OverlayFocus(
    () => this.element,
    () => this.close(),
  );
  private ref: OverlayRef | undefined;
  private panel: ComponentRef<RailMenuPanel> | undefined;
  /**
   * Set for the rest of the task that closed the menu: closing hands focus back to the item
   * (Escape, Shift+Tab from the first link), and that focus must not show the menu again.
   */
  private justClosed = false;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private stopWatchingFocus: (() => void) | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
    // The route changes under an open menu (a link was followed elsewhere), so it marks the new sub-page.
    effect(() => {
      const current = this.neatRailMenuCurrent();
      if (this.panel) {
        this.panel.setInput('current', current);
        this.panel.changeDetectorRef.detectChanges();
      }
    });
  }

  /** A press only navigates (the router link does); it puts the menu away. */
  protected pressed(): void {
    this.close();
  }

  /** Keyboard focus shows the menu; a pointer's focus (a press) does not. */
  protected focused(): void {
    if (!this.justClosed && this.showsFocusRing()) {
      this.cancelClose();
      this.show();
    }
  }

  protected hovered(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
      return;
    }
    this.cancelClose();
    this.show();
  }

  protected left(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      this.closeAfterHover();
    }
  }

  private show(): void {
    if (this.ref) {
      return;
    }
    this.openMenu.claim(this);
    const ref = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.element)
        .withPositions(this.positions()),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });
    const rows = Injector.create({
      parent: this.injector,
      providers: [{ provide: RailState, useValue: LABELED_RAIL }],
    });
    const panel = ref.attach(new ComponentPortal(RailMenuPanel, null, rows));
    panel.setInput('page', this.neatRailMenu());
    panel.setInput('current', this.neatRailMenuCurrent());
    panel.instance.chosen.subscribe(() => this.closeToItem());
    panel.changeDetectorRef.detectChanges();
    this.panel = panel;
    ref.overlayElement.addEventListener('pointerenter', () => this.cancelClose());
    ref.overlayElement.addEventListener('pointerleave', () => this.closeAfterHover());
    ref.keydownEvents().subscribe((event) => this.keydown(event, ref.overlayElement));
    ref.outsidePointerEvents().subscribe((event) => {
      if (!this.element.contains(event.target as Node)) {
        this.close();
      }
    });
    this.stopWatchingFocus = this.focus.watchOutsideFocus();
    this.ref = ref;
    this.controls.set(panel.instance.panelId);
  }

  /**
   * Beside the sidebar, not the item: the menu starts past the sidebar's edge, level with the item.
   */
  private positions(): ConnectedPosition[] {
    const sidebar = this.element.closest('[data-slot="sidebar"]') ?? this.element;
    const offsetX =
      sidebar.getBoundingClientRect().right - this.element.getBoundingClientRect().right + RAIL_GAP;
    return [
      { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX },
      { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom', offsetX },
    ];
  }

  private keydown(event: KeyboardEvent, panel: HTMLElement): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeToItem();
    } else if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.target === this.element
    ) {
      // The browser would go on to the next item, past the menu at the end of the document.
      event.preventDefault();
      this.focus.focusFirstControl(panel);
    } else {
      this.focus.carryTabOrder(event, panel);
    }
  }

  /** The pointer left the item or the menu: close after the delay, unless the keyboard holds it. */
  private closeAfterHover(): void {
    this.cancelClose();
    this.closeTimer = setTimeout(() => {
      if (!this.keyboardHolds()) {
        this.close();
      }
    }, HOVER_CLOSE_DELAY);
  }

  /** Whether keyboard focus is on the item or inside the menu, which the pointer leaving keeps. */
  private keyboardHolds(): boolean {
    const active = this.element.ownerDocument.activeElement;
    if (!active || !this.ref) {
      return false;
    }
    return (
      this.ref.overlayElement.contains(active) || (active === this.element && this.showsFocusRing())
    );
  }

  private showsFocusRing(): boolean {
    return this.element.matches(':focus-visible');
  }

  private cancelClose(): void {
    clearTimeout(this.closeTimer);
  }

  /**
   * Closes and returns focus to the item, unless focus is on the page already (a hover-opened
   * menu, Escape pressed in a field): that is not the menu's to take.
   */
  private closeToItem(): void {
    const active = this.element.ownerDocument.activeElement;
    const ownsFocus =
      !active || active === this.element.ownerDocument.body || this.focus.holdsFocus(active);
    this.close();
    if (ownsFocus) {
      this.element.focus();
    }
  }

  /** Public to `OpenRailMenu`, which puts a menu away when another opens. */
  close(): void {
    this.openMenu.release(this);
    this.justClosed = true;
    queueMicrotask(() => (this.justClosed = false));
    this.cancelClose();
    this.stopWatchingFocus?.();
    this.stopWatchingFocus = undefined;
    this.ref?.dispose();
    this.ref = undefined;
    this.panel = undefined;
    this.controls.set(null);
  }
}
