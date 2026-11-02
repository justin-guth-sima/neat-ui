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
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { OverlayFocus } from '../overlay/overlay-focus';
import { PANEL_SURFACE_CLASSES } from '../overlay/panel-surface';
import { hlm } from '../ui/utils/src';
import { NeatNavChild, NeatNavItem } from './nav-item';
import { NeatRailItem, RAIL_ITEM_HAS_MENU, RailState } from './rail-item';

/** The space between the rail's edge and the menu, so its outline does not touch the rail. */
const RAIL_GAP = 4;

/**
 * How long a menu opened by hover outlives the pointer's leaving, so that the pointer can cross
 * the rail's padding and the gap to the menu. The tooltip it replaces hides at once, but it has
 * nothing to reach.
 */
const HOVER_CLOSE_DELAY = 150;

/** The menu's rows are rail items on a rail that shows its labels, whatever the real one does. */
const LABELLED_RAIL = { expanded: signal(true), collapseWhenNarrow: () => undefined };

/** Numbers each menu, for the id its heading gives it as a name. */
let nextMenuId = 0;

/**
 * The menu of a collapsed rail item with sub-pages: the page's name as a heading, then one link
 * per sub-page with the open one marked. A non-modal dialog named by its heading, so a screen
 * reader gets a list of links named by the page. On the shared panel surface, and its rows are the
 * rail's own sub-page rows (`neatRailItem` in its `data-child` variant), so their look is stated
 * once, in `rail-item.css`. Internal to the kit: `RailMenu` opens it.
 */
@Component({
  selector: 'neat-rail-menu-panel',
  imports: [NeatRailItem, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
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
  protected readonly headingId = `neat-rail-menu-${++nextMenuId}`;
  protected readonly panelClasses = hlm(PANEL_SURFACE_CLASSES, 'w-auto min-w-48 gap-0 p-2');
}

/**
 * Turns a collapsed rail item that has sub-pages into the button that opens their menu, in place
 * of the link to the page:
 * `<button neatRailItem [neatRailMenu]="page" [neatRailMenuCurrent]="child">`.
 * A press (click, tap, Enter, Space) navigates to the page's `path`, as the expanded rail's link
 * does (the app's routes decide which sub-page that shows), and opens the menu, whose current
 * sub-page follows the route. With a mouse or pen, hovering opens the menu too, without
 * navigating, and leaving closes it after `HOVER_CLOSE_DELAY` unless a press has kept it.
 *
 * It stays a button and navigates with the router, rather than becoming a link that also opens
 * the menu: a link would need its Enter, its modified clicks and `aria-expanded` reconciled with
 * the menu, where a button already has Enter and Space as a click and `aria-haspopup`/
 * `aria-expanded` mean what they say. The cost is that Ctrl/Cmd/middle click are plain presses,
 * not "open in a new tab"; the menu's own rows are links for that. It replaces the item's tooltip (`NeatRailItem`
 * switches that off), as the menu's heading says what the tooltip would.
 *
 * On CDK's overlay, not brain's popover, whose positions open below its trigger where this menu
 * opens beside the rail. CDK gives the placement, Escape and outside presses; the focus rules are
 * `OverlayFocus`'s, shared with `neat-popover`: a press moves focus to the first link; Tab from the
 * item goes to the first link; Tab from the last link and Shift+Tab from the first leave the menu
 * as `neat-popover` does; focus landing elsewhere closes it. Escape closes it and returns focus to
 * the item, unless focus has already moved elsewhere; a press outside closes it and leaves focus
 * where the press put it.
 */
@Directive({
  selector: 'button[neatRailItem][neatRailMenu]',
  providers: [{ provide: RAIL_ITEM_HAS_MENU, useValue: true }],
  host: {
    'aria-haspopup': 'dialog',
    '[attr.aria-expanded]': 'open()',
    '(click)': 'pressed()',
    '(pointerenter)': 'hovered($event)',
    '(pointerleave)': 'left($event)',
  },
})
export class RailMenu {
  /** The page whose sub-pages the menu lists. */
  readonly neatRailMenu = input.required<NeatNavItem>();
  /** The page's open sub-page, which the menu marks. */
  readonly neatRailMenuCurrent = input<NeatNavChild | undefined>();

  protected readonly open = signal(false);
  private readonly element: HTMLButtonElement = inject(ElementRef).nativeElement;
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly focus = new OverlayFocus(
    () => this.element,
    () => this.close(),
  );
  private ref: OverlayRef | undefined;
  private panel: ComponentRef<RailMenuPanel> | undefined;
  private by: 'press' | 'hover' = 'press';
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private stopWatchingFocus: (() => void) | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
    // The press navigates as it opens, so the menu marks the sub-page the new route shows.
    effect(() => {
      const current = this.neatRailMenuCurrent();
      if (this.panel) {
        this.panel.setInput('current', current);
        this.panel.changeDetectorRef.detectChanges();
      }
    });
  }

  protected pressed(): void {
    void this.router.navigateByUrl(this.neatRailMenu().path);
    if (this.ref && this.by === 'press') {
      this.close();
      return;
    }
    this.show('press');
    this.focus.focusFirstControl(this.ref?.overlayElement ?? null);
  }

  protected hovered(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
      return;
    }
    this.cancelClose();
    this.show('hover');
  }

  protected left(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      this.closeAfterHover();
    }
  }

  private show(by: 'press' | 'hover'): void {
    if (this.ref) {
      // A press on a menu hover opened keeps it: the pointer leaving no longer closes it.
      this.by = by === 'press' ? 'press' : this.by;
      return;
    }
    this.by = by;
    const ref = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.element)
        .withPositions(this.positions()),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });
    const rows = Injector.create({
      parent: this.injector,
      providers: [{ provide: RailState, useValue: LABELLED_RAIL }],
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
    this.open.set(true);
  }

  /** Beside the rail, not the item: the menu starts past the rail's edge, level with the item. */
  private positions(): ConnectedPosition[] {
    const rail = this.element.closest('.rail') ?? this.element;
    const offsetX =
      rail.getBoundingClientRect().right - this.element.getBoundingClientRect().right + RAIL_GAP;
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

  private closeAfterHover(): void {
    if (this.by === 'hover') {
      this.cancelClose();
      this.closeTimer = setTimeout(() => this.close(), HOVER_CLOSE_DELAY);
    }
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

  private close(): void {
    this.cancelClose();
    this.stopWatchingFocus?.();
    this.stopWatchingFocus = undefined;
    this.ref?.dispose();
    this.ref = undefined;
    this.panel = undefined;
    this.open.set(false);
  }
}
