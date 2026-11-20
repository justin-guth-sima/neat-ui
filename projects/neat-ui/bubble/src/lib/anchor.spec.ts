import { ElementRef } from '@angular/core';
import { anchorElements, tailAt, unionBox } from './anchor';

describe('anchorElements', () => {
  afterEach(() => document.body.replaceChildren());

  it('takes an element, an ElementRef or a list, and leaves out what is not in the document', () => {
    const [a, b] = [document.createElement('span'), document.createElement('span')];
    document.body.append(a, b);
    const loose = document.createElement('span');

    expect(anchorElements(a)).toEqual([a]);
    expect(anchorElements(new ElementRef(b))).toEqual([b]);
    expect(anchorElements([a, loose, b])).toEqual([a, b]);
    expect(anchorElements(loose)).toEqual([]);
    expect(anchorElements(null)).toEqual([]);
  });
});

describe('unionBox', () => {
  it('is the smallest box around the boxes, null for none', () => {
    expect(
      unionBox([
        { x: 10, y: 20, width: 100, height: 16 },
        { x: 4, y: 36, width: 60, height: 16 },
      ]),
    ).toEqual({ x: 4, y: 20, width: 106, height: 32 });
    expect(unionBox([])).toBeNull();
  });
});

describe('tailAt', () => {
  const bubble = { x: 100, y: 50, width: 200, height: 80 };

  it("points at the anchor's middle along the bubble's edge", () => {
    expect(tailAt('top', { x: 150, y: 140, width: 40, height: 10 }, bubble, 16)).toBe(70);
    expect(tailAt('right', { x: 20, y: 60, width: 40, height: 20 }, bubble, 16)).toBe(20);
  });

  it("stays clear of the bubble's corners when the anchor's middle is past its ends", () => {
    expect(tailAt('bottom', { x: 0, y: 0, width: 20, height: 10 }, bubble, 16)).toBe(16);
    expect(tailAt('top', { x: 400, y: 0, width: 20, height: 10 }, bubble, 16)).toBe(184);
    expect(tailAt('left', { x: 0, y: 300, width: 10, height: 10 }, bubble, 16)).toBe(64);
  });
});
