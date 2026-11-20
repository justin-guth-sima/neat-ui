import {
  type ConnectedOverlayPositionChange,
  type ConnectedPosition,
  type FlexibleConnectedPositionStrategy,
  Overlay,
  type OverlayRef,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  NgZone,
  output,
  type TemplateRef,
  untracked,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { ɵhlm as hlm, ɵPANEL_SURFACE_CLASSES as PANEL_SURFACE_CLASSES } from '@sima/neat-ui';
import {
  anchorElements,
  type NeatBubbleAnchor,
  tailAt,
  type TailSide,
  unionBox,
  type ViewportBox,
} from './anchor';
import { trackAnchor } from './tracking';

/** The side of its anchor a bubble prefers: it takes another where this one has no room. */
export type NeatBubbleSide = TailSide;

/** The space between the anchor and the bubble's edge, which the tail crosses. */
const GAP = 10;
/** How close to the window's edge a bubble may come. */
const VIEWPORT_MARGIN = 8;
/** How far the tail keeps from the bubble's ends, clear of its rounded corners. */
const TAIL_INSET = 16;

const POSITIONS: Record<TailSide, ConnectedPosition> = {
  top: { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -GAP },
  bottom: {
    originX: 'center',
    originY: 'bottom',
    overlayX: 'center',
    overlayY: 'top',
    offsetY: GAP,
  },
  left: { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -GAP },
  right: { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: GAP },
};
const OPPOSITE: Record<TailSide, TailSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/** The side first, then the one across from it, then the other two. */
function positionsFor(side: TailSide): ConnectedPosition[] {
  const order = [side, OPPOSITE[side]];
  const rest = (['top', 'bottom', 'right', 'left'] as const).filter((s) => !order.includes(s));
  return [...order, ...rest].map((s) => POSITIONS[s]);
}

/** The side of the anchor a placed position puts the bubble on. */
function sideOf(change: ConnectedOverlayPositionChange): TailSide {
  const { originX, originY, overlayX, overlayY } = change.connectionPair;
  if (originY === 'top' && overlayY === 'bottom') return 'top';
  if (originY === 'bottom' && overlayY === 'top') return 'bottom';
  if (originX === 'start' && overlayX === 'end') return 'left';
  return 'right';
}

const box = (element: Element): ViewportBox => element.getBoundingClientRect();

/** Numbers each bubble, for its id. */
let nextBubbleId = 0;

/**
 * A speech bubble that points at what it explains: the content inside the element, on the panel
 * surface of a popover, with a tail toward its `anchor`.
 *
 * ```html
 * <button #help neatButton type="button" (click)="open.set(!open())">What is a pipeline?</button>
 * <neat-bubble [anchor]="open() ? help : null" side="right">
 *   A pipeline is the chain of nodes a frame runs through.
 * </neat-bubble>
 * ```
 *
 * For a note on a part of the page: a step of a walk through code, a remark on a figure, a pointer
 * to a control. It shows while it has an anchor: null hides it, so the app decides when, and it
 * may move to another anchor while it shows. It is not a tooltip, which repeats a control's name
 * in the inverted look while the control is hovered or focused, nor a popover, which a trigger
 * opens and which holds controls.
 *
 * It sits beside its anchor, on the `side` it prefers (`top` by default), and takes the side across
 * from it, then another, where that has no room. It stays in the window, and its tail moves along
 * its edge to keep pointing at the anchor's middle. An anchor of several elements is the one box
 * around them. It follows its anchor as the page scrolls or a box around the anchor does, and hides
 * while the anchor is scrolled out of view.
 *
 * It is drawn in the overlay above the page, not where the element stands, so a card or a scrolling
 * box does not clip it. A screen reader meets it there, at the end of the page: point at it from
 * what it explains with `aria-describedby` and its `id` where that takes the focus. `hover` says
 * when a mouse or a pen comes onto it and leaves it, for a bubble shown on hover that should stay
 * while the pointer moves onto it.
 */
@Component({
  selector: 'neat-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #panel>
      <div
        class="bubble"
        [id]="id"
        [class]="classes"
        (pointerenter)="pointer($event, true)"
        (pointerleave)="pointer($event, false)"
      >
        <ng-content />
      </div>
    </ng-template>
  `,
  styleUrl: './bubble.css',
})
export class NeatBubble {
  /** What the bubble points at, a `NeatBubbleAnchor`: it shows while there is one. */
  readonly anchor = input<NeatBubbleAnchor | null>(null);
  /** The side of the anchor the bubble prefers, a `NeatBubbleSide`. */
  readonly side = input<NeatBubbleSide>('top');
  /** Whether a mouse or a pen is over the bubble, each time that changes. */
  readonly hover = output<boolean>();

  /** The bubble's id, for an `aria-describedby` on what it explains. */
  readonly id = `neat-bubble-${++nextBubbleId}`;

  protected readonly classes = hlm(PANEL_SURFACE_CLASSES, 'w-auto max-w-80 gap-2 p-3');

  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private readonly overlay = inject(Overlay);
  private readonly containers = inject(ViewContainerRef);
  private readonly zone = inject(NgZone);
  private ref: OverlayRef | undefined;
  private strategy: FlexibleConnectedPositionStrategy | undefined;
  private placed: TailSide = 'top';
  private stopTracking: (() => void) | undefined;

  constructor() {
    afterRenderEffect(() => {
      const anchors = anchorElements(this.anchor());
      const side = this.side();
      untracked(() => this.show(anchors, side));
    });
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected pointer(event: PointerEvent, over: boolean): void {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') this.hover.emit(over);
  }

  private show(anchors: readonly Element[], side: TailSide): void {
    this.stopTracking?.();
    this.stopTracking = undefined;
    if (!anchors.length) {
      this.hide();
      return;
    }
    if (!this.ref || !this.strategy) {
      this.strategy = this.overlay
        .position()
        .flexibleConnectedTo(unionBox(anchors.map(box)) ?? { x: 0, y: 0 })
        .withPositions(positionsFor(side))
        .withFlexibleDimensions(false)
        .withPush(true)
        .withViewportMargin(VIEWPORT_MARGIN);
      this.strategy.positionChanges.subscribe((change) => (this.placed = sideOf(change)));
      this.ref = this.overlay.create({
        positionStrategy: this.strategy,
        scrollStrategy: this.overlay.scrollStrategies.noop(),
      });
      this.ref.attach(new TemplatePortal(this.panel(), this.containers));
    } else {
      this.strategy.withPositions(positionsFor(side));
    }
    const ref = this.ref;
    const strategy = this.strategy;
    const bubble = ref.overlayElement.querySelector<HTMLElement>('.bubble');
    if (!bubble) return;
    const view = bubble.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    const place = () => {
      const anchor = unionBox(anchors.map(box));
      if (!anchor) return;
      strategy.setOrigin(anchor);
      ref.updatePosition();
      bubble.dataset['side'] = this.placed;
      bubble.style.setProperty(
        '--tail-at',
        `${tailAt(this.placed, anchor, box(bubble), TAIL_INSET)}px`,
      );
    };
    place();
    if (!view) return;
    this.zone.runOutsideAngular(() => {
      this.stopTracking = trackAnchor(view, anchors, bubble, place, (visible) => {
        bubble.toggleAttribute('data-hidden', !visible);
      });
    });
  }

  private hide(): void {
    this.stopTracking?.();
    this.stopTracking = undefined;
    this.ref?.dispose();
    this.ref = undefined;
    this.strategy = undefined;
  }
}
