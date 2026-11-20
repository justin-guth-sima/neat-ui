import { ElementRef } from '@angular/core';

/**
 * What a bubble points at: an element, an `ElementRef` (a template reference to a component), or
 * several elements, which it treats as the one box around them all (the lines of a passage).
 */
export type NeatBubbleAnchor = Element | ElementRef<Element> | readonly Element[];

/** A box in the viewport's coordinates, as CDK's overlay takes an origin. */
export interface ViewportBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The elements of `anchor` that are in the document, none for no anchor. */
export function anchorElements(anchor: NeatBubbleAnchor | null | undefined): readonly Element[] {
  if (!anchor) return [];
  const elements =
    anchor instanceof ElementRef
      ? [anchor.nativeElement]
      : Array.isArray(anchor)
        ? anchor
        : [anchor];
  return (elements as readonly Element[]).filter((element) => element.isConnected);
}

/** The smallest box around `boxes`, null for none. */
export function unionBox(boxes: readonly ViewportBox[]): ViewportBox | null {
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Where a bubble's tail sits: the side of the anchor the bubble is on. */
export type TailSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * Where along the bubble's edge its tail points, in px from the edge's start: at the anchor's
 * middle, kept `inset` from the bubble's ends so the tail stays clear of its rounded corners.
 */
export function tailAt(
  side: TailSide,
  anchor: ViewportBox,
  bubble: ViewportBox,
  inset: number,
): number {
  const across = side === 'top' || side === 'bottom';
  const middle = across
    ? anchor.x + anchor.width / 2 - bubble.x
    : anchor.y + anchor.height / 2 - bubble.y;
  const length = across ? bubble.width : bubble.height;
  return Math.max(inset, Math.min(length - inset, middle));
}
