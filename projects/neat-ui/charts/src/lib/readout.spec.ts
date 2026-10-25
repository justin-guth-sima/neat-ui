import {
  whenText,
  describe as describeValue,
  fractionAcross,
  ReadoutCursor,
  readoutAt,
  sampleAfter,
} from './readout';

/** A cursor over five numbered samples, the pointer a place across them from 0 to 1. */
function cursorOverFive() {
  return new ReadoutCursor<number, number>({
    under: (pointer) => Math.round(pointer * 4),
    fit: (index) => Math.min(index, 4),
    start: () => 4,
    after: (key, current) => sampleAfter(key, current, 5),
    spoken: (index) => `sample ${index}`,
  });
}

const press = (key: string) => new KeyboardEvent('keydown', { key, cancelable: true });

describe('sampleAfter', () => {
  it('moves by one and to the ends, stopping there', () => {
    expect(sampleAfter('ArrowLeft', 3, 5)).toBe(2);
    expect(sampleAfter('ArrowLeft', 0, 5)).toBe(0);
    expect(sampleAfter('ArrowRight', 3, 5)).toBe(4);
    expect(sampleAfter('ArrowRight', 4, 5)).toBe(4);
    expect(sampleAfter('Home', 3, 5)).toBe(0);
    expect(sampleAfter('End', 1, 5)).toBe(4);
  });

  it('brings a hidden readout up at the newest sample, whichever arrow', () => {
    expect(sampleAfter('ArrowLeft', null, 5)).toBe(4);
    expect(sampleAfter('ArrowRight', null, 5)).toBe(4);
  });

  it('leaves other keys alone, and every key without samples', () => {
    expect(sampleAfter('Tab', 2, 5)).toBeNull();
    expect(sampleAfter('ArrowLeft', null, 0)).toBeNull();
    expect(sampleAfter('Home', null, 0)).toBeNull();
  });
});

describe('ReadoutCursor', () => {
  it('shows what the pointer is over, and a key takes over until the pointer moves again', () => {
    const cursor = cursorOverFive();
    expect(cursor.active()).toBeNull();
    cursor.pointerTo(0.5);
    expect(cursor.active()).toBe(2);
    cursor.keydown(press('ArrowLeft'));
    expect(cursor.active()).toBe(1);
    cursor.pointerTo(1);
    expect(cursor.active()).toBe(4);
    cursor.pointerLeave();
    expect(cursor.active()).toBeNull();
  });

  it('keeps what a key chose when the pointer leaves', () => {
    const cursor = cursorOverFive();
    cursor.focus();
    expect(cursor.active()).toBe(4);
    cursor.pointerLeave();
    expect(cursor.active()).toBe(4);
    cursor.keydown(press('Home'));
    expect(cursor.active()).toBe(0);
  });

  it('announces after a key and at no other time', () => {
    const cursor = cursorOverFive();
    cursor.pointerTo(0.25);
    cursor.focus();
    expect(cursor.announcement(), 'neither the pointer nor focus speaks').toBe('');
    cursor.keydown(press('ArrowLeft'));
    expect(cursor.announcement()).toBe('sample 0');
    cursor.pointerTo(1);
    expect(cursor.announcement(), 'a pointer move leaves it as it was').toBe('sample 0');
    cursor.pointerLeave();
    cursor.blur();
    expect(cursor.announcement()).toBe('');
    expect(cursor.active()).toBeNull();
  });

  it("keeps a pointer's cell when focus follows a click", () => {
    const cursor = cursorOverFive();
    cursor.pointerTo(0.5);
    cursor.focus();
    expect(cursor.active()).toBe(2);
  });

  it('claims a key only if it uses it', () => {
    const cursor = cursorOverFive();
    const arrow = press('ArrowLeft');
    cursor.keydown(arrow);
    expect(arrow.defaultPrevented).toBe(true);
    const tab = press('Tab');
    cursor.keydown(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('leaves Escape to whatever holds the chart unless a readout is there to close', () => {
    const cursor = cursorOverFive();
    const hidden = press('Escape');
    cursor.keydown(hidden);
    expect(hidden.defaultPrevented).toBe(false);

    cursor.focus();
    cursor.keydown(press('ArrowLeft'));
    const shown = press('Escape');
    const stop = vi.spyOn(shown, 'stopPropagation');
    cursor.keydown(shown);
    expect(shown.defaultPrevented).toBe(true);
    expect(stop).toHaveBeenCalled();
    expect(cursor.active()).toBeNull();
    expect(cursor.announcement()).toBe('');
  });
});

describe('the readout words', () => {
  it('dates a sample by how long before the newest it was taken', () => {
    const times = [0, 60_000, 120_000];
    expect(whenText(times, 3, 0)).toBe('2 min ago');
    expect(whenText(times, 3, 2)).toBe('just now');
    expect(whenText([0, null, 120_000], 3, 1), 'a sample without a time').toBeNull();
    expect(whenText([0, 60_000], 3, 0), 'times that stop short').toBeNull();
    expect(whenText([120_000, 0], 2, 0), 'a sample after the newest').toBeNull();
  });

  it('dates a sample by its offset from the first on the elapsed axis', () => {
    const times = [5_000, 22_000, 38_900];
    expect(whenText(times, 3, 0, 'elapsed')).toBe('at 0 s');
    expect(whenText(times, 3, 1, 'elapsed')).toBe('at 17 s');
    expect(whenText(times, 3, 2, 'elapsed')).toBe('at 33.9 s');
    expect(whenText([0, null, 120_000], 3, 1, 'elapsed'), 'a sample without a time').toBeNull();
    expect(whenText([null, 1000], 2, 1, 'elapsed'), 'no first time').toBeNull();
    expect(whenText([5000, 0], 2, 1, 'elapsed'), 'a sample before the first').toBeNull();
  });

  it('says a missing sample as a dash', () => {
    const format = (value: number) => `${value} W`;
    expect(describeValue(3, format)).toBe('3 W');
    expect(describeValue(null, format)).toBe('—');
    expect(describeValue(undefined, format)).toBe('—');
    expect(describeValue(NaN, format)).toBe('—');
  });

  it('reads the date and then each row, one sentence for the live region', () => {
    const readout = readoutAt(0.5, '1 min ago', [
      { key: 'a', label: 'CPU', value: '3%', color: null },
      { key: 'b', label: 'GPU', value: '—', color: null },
    ]);
    expect(readout.spoken).toBe('1 min ago, CPU 3%, GPU —');
    expect(readoutAt(0, null, []).spoken).toBe('');
  });
});

describe('fractionAcross', () => {
  const element = (width: number) =>
    ({ getBoundingClientRect: () => ({ left: 100, width }) }) as unknown as HTMLElement;
  const at = (clientX: number) => new MouseEvent('pointermove', { clientX });

  it("is the pointer's place across an element, held to 0 and 1", () => {
    expect(fractionAcross(at(250), element(300))).toBe(0.5);
    expect(fractionAcross(at(0), element(300))).toBe(0);
    expect(fractionAcross(at(900), element(300))).toBe(1);
  });

  it('is nothing while the element has no width', () => {
    expect(fractionAcross(at(250), element(0))).toBeNull();
  });
});
