import { metersText } from './geometry';
import type { NeatBevObject } from './model';

/*
 * The readout of the object under the pointer: its label, its distance from the vehicle and the
 * app's text for it, in a box beside it. Written straight to the DOM from the frame that draws the
 * object, outside change detection, and only what changed, since the object may move on every
 * frame. The swatch of its color beside the label is the component's (`neat-swatch`), bound to a
 * signal that changes only when another object is read out.
 */

/** How far the box stands from the object's center, CSS px. */
const GAP = 12;

/** Where the box's top left goes: right of `x`, or left of it where it would leave the box. */
export function readoutPlace(
  x: number,
  y: number,
  width: number,
  height: number,
  boxWidth: number,
  boxHeight: number,
): { left: number; top: number } {
  let left = x + GAP;
  if (left + width > boxWidth) left = x - GAP - width;
  const top = Math.min(Math.max(0, y - GAP - height / 2), Math.max(0, boxHeight - height));
  return { left: Math.max(0, left), top };
}

/** The distance of `object`'s center from the vehicle, as the readout says it. */
export function distanceText(object: NeatBevObject): string {
  return metersText(Math.hypot(object.x, object.y));
}

export class BevReadout {
  private shown = false;
  private readonly lines = { name: '', distance: '', text: '' };

  constructor(
    private readonly box: HTMLElement,
    private readonly name: HTMLElement,
    private readonly distance: HTMLElement,
    private readonly text: HTMLElement,
  ) {}

  /** Shows `object`, its center at (`x`, `y`) in a box `width` × `height` px. */
  show(object: NeatBevObject, x: number, y: number, width: number, height: number): void {
    this.write('name', this.name, object.label);
    this.write('distance', this.distance, distanceText(object));
    this.write('text', this.text, object.text ?? '');
    this.text.hidden = !object.text;
    if (!this.shown) {
      this.shown = true;
      this.box.hidden = false;
    }
    const { left, top } = readoutPlace(
      x,
      y,
      this.box.offsetWidth,
      this.box.offsetHeight,
      width,
      height,
    );
    this.box.style.transform = `translate(${left}px, ${top}px)`;
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.box.hidden = true;
  }

  private write(line: 'name' | 'distance' | 'text', element: HTMLElement, value: string): void {
    if (this.lines[line] === value) return;
    this.lines[line] = value;
    element.textContent = value;
  }
}
