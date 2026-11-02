import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeatNavChild, NeatNavItem } from './nav-item';

/** The space between the rail's edge and the menu, so its outline does not touch the rail. */
const RAIL_GAP = 4;

/**
 * How long a menu opened by hover outlives the pointer's leaving, so that the pointer can cross
 * the rail's padding and the gap to the menu. The tooltip it replaces hides at once, but it has
 * nothing to reach.
 */
const HOVER_CLOSE_DELAY = 150;

/** Numbers each menu, for the id its heading gives it as a name. */
let nextMenuId = 0;

/**
 * The menu of a collapsed rail item with sub-pages: the page's name as a heading, then one link
 * per sub-page with the open one marked. A non-modal dialog named by its heading, so a screen
 * reader gets a list of links named by the page. Internal to the kit: `RailMenu` opens it.
 */
@Component({
  selector: 'neat-rail-menu-panel',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    class: 'shadow-md',
    '[attr.aria-labelledby]': 'headingId',
  },
  template: `
    <h2 class="heading" [id]="headingId">{{ page().label }}</h2>
    <ul class="links">
      @for (child of page().children; track child.path) {
        <li>
          <a
            class="link"
            [routerLink]="child.path"
            [attr.aria-current]="child === current() ? 'page' : null"
            (click)="chosen.emit()"
            >{{ child.label }}</a
          >
        </li>
      }
    </ul>
  `,
  styleUrl: './rail-menu.css',
})
export class RailMenuPanel {
  readonly page = input.required<NeatNavItem>();
  readonly current = input<NeatNavChild>();
  /** A link was followed, which puts the menu away. */
  readonly chosen = output<void>();
  protected readonly headingId = `neat-rail-menu-${++nextMenuId}`;
}

/**
 * Turns a collapsed rail item that has sub-pages into the button that opens their menu, in place
 * of the link to the page: `<button neatRailItem [neatRailMenu]="page" [neatRailMenuCurrent]="child">`.
 * A press (click, tap, Enter, Space) opens it and navigates nowhere, since the page is its first
 * sub-page; with a mouse or pen, hovering opens it too, and leaving closes it after
 * `HOVER_CLOSE_DELAY` unless a press has kept it. It replaces the item's tooltip (`NeatRailItem`
 * switches that off), as the menu's heading says what the tooltip would.
 *
 * The kit's own overlay on CDK's, not `neat-popover`, which is a secondary entry the shell in the
 * primary cannot import, and not brain's popover, whose positions open below its trigger where
 * this menu opens beside the rail. CDK gives the placement, Escape and outside presses; the rest is
 * the focus rules of `neat-popover`, which a menu rendered at the end of the document needs:
 * - a press moves focus to the first link; Escape closes it and returns focus to the item;
 * - Tab from the item goes to the first link (the browser would go on to the next item), Tab from
 *   the last link closes the menu and goes on from the item, and Shift+Tab from the first link
 *   returns to the item;
 * - a press outside closes it and leaves focus where the press put it.
 */
@Directive({
  selector: 'button[neatRailItem][neatRailMenu]',
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
  private ref: OverlayRef | undefined;
  private by: 'press' | 'hover' = 'press';
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
  }

  protected pressed(): void {
    if (this.ref && this.by === 'press') {
      this.close();
      return;
    }
    this.show('press');
    this.focusFirstLink();
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
    const panel = ref.attach(new ComponentPortal(RailMenuPanel, null, this.injector));
    panel.setInput('page', this.neatRailMenu());
    panel.setInput('current', this.neatRailMenuCurrent());
    panel.instance.chosen.subscribe(() => this.closeToItem());
    panel.changeDetectorRef.detectChanges();
    ref.overlayElement.addEventListener('pointerenter', () => this.cancelClose());
    ref.overlayElement.addEventListener('pointerleave', () => this.closeAfterHover());
    ref.keydownEvents().subscribe((event) => this.keydown(event));
    ref.outsidePointerEvents().subscribe((event) => {
      if (!this.element.contains(event.target as Node)) {
        this.close();
      }
    });
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

  private keydown(event: KeyboardEvent): void {
    const target = event.target as Node | null;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeToItem();
      return;
    }
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const links = this.links();
    if (!event.shiftKey && this.element.contains(target)) {
      event.preventDefault();
      links[0]?.focus();
    } else if (event.shiftKey && target === links[0]) {
      event.preventDefault();
      this.closeToItem();
    } else if (!event.shiftKey && target === links.at(-1)) {
      // The browser goes on from where focus is when the key's default runs: from the item.
      this.closeToItem();
    }
  }

  private links(): HTMLElement[] {
    return Array.from(this.ref?.overlayElement.querySelectorAll('a') ?? []);
  }

  private focusFirstLink(): void {
    this.links()[0]?.focus();
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

  private closeToItem(): void {
    this.close();
    this.element.focus();
  }

  private close(): void {
    this.cancelClose();
    this.ref?.dispose();
    this.ref = undefined;
    this.open.set(false);
  }
}
