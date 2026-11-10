import type { NeatBevObject } from './model';
import { BevReadout, distanceText, readoutPlace } from './readout';
import bevStyles from './bev.css' with { loader: 'text' };

const car: NeatBevObject = {
  x: 3,
  y: 4,
  length: 4,
  width: 2,
  yaw: 0,
  label: 'car',
  text: 'Score 0.91',
};

describe('readoutPlace', () => {
  it("stands right of the object, its middle a little above the object's", () => {
    expect(readoutPlace(100, 100, 80, 40, 400, 300)).toEqual({ left: 112, top: 68 });
  });

  it('goes left of the object where it would leave the box on the right', () => {
    expect(readoutPlace(350, 100, 80, 40, 400, 300).left).toBe(350 - 12 - 80);
  });

  it('stays inside the box at the top and the bottom', () => {
    expect(readoutPlace(100, 5, 80, 40, 400, 300).top).toBe(0);
    expect(readoutPlace(100, 299, 80, 40, 400, 300).top).toBe(260);
  });
});

describe('distanceText', () => {
  it('says the distance from the vehicle in meters, to a tenth', () => {
    expect(distanceText(car)).toBe('5 m');
    expect(distanceText({ ...car, x: 10, y: 10 })).toBe('14.1 m');
  });
});

describe('BevReadout', () => {
  const make = () => {
    const parts = ['box', 'name', 'distance', 'text'].map(() => document.createElement('span'));
    parts[0].hidden = true;
    const [box, name, distance, text] = parts;
    return {
      box,
      name,
      distance,
      text,
      readout: new BevReadout(box, name, distance, text),
    };
  };

  it('shows the label, the distance and the text, placed by a transform', () => {
    const { box, name, distance, text, readout } = make();
    readout.show(car, 100, 100, 400, 300);
    expect(box.hidden).toBe(false);
    expect([name.textContent, distance.textContent, text.textContent]).toEqual([
      'car',
      '5 m',
      'Score 0.91',
    ]);
    expect(box.style.transform).toBe('translate(112px, 88px)');
  });

  it('hides the text line for an object without text, and the box on hide', () => {
    const { box, text, readout } = make();
    readout.show({ ...car, text: undefined }, 100, 100, 400, 300);
    expect(text.hidden).toBe(true);
    readout.hide();
    expect(box.hidden).toBe(true);
  });

  it('writes a line only when it changes', () => {
    const { name, readout } = make();
    readout.show(car, 100, 100, 400, 300);
    const node = name.firstChild;
    readout.show({ ...car, x: 5 }, 110, 100, 400, 300);
    expect(name.firstChild).toBe(node);
  });
});

describe('the swatch of the readout', () => {
  it('is the kit swatch, not restated in the view stylesheet', () => {
    expect(bevStyles).not.toMatch(/\.swatch\b/);
  });
});
