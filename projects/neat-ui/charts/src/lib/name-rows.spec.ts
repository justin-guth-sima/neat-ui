import { type NameBox, placeNames } from './name-rows';

/** A name `width` wide (its gap included) whose run starts `left` px into a 600 px strip. */
const box = (key: string, left: number, width: number): NameBox => ({ key, left, width });

const rowsOf = (placed: ReturnType<typeof placeNames>) =>
  Object.fromEntries([...placed].map(([key, name]) => [key, name.row]));

describe('placeNames', () => {
  it('puts every name that fits in the first row, at its run’s start', () => {
    const placed = placeNames([box('b', 300, 100), box('a', 100, 100)], 600, 1);

    expect([...placed.values()]).toEqual([
      { key: 'b', x: 300, row: 0 },
      { key: 'a', x: 100, row: 0 },
    ]);
  });

  it('lets the newest win: an older name that would overlap it is left out with one row', () => {
    const placed = placeNames([box('new', 150, 100), box('old', 100, 100)], 600, 1);

    expect(rowsOf(placed)).toEqual({ new: 0 });
  });

  it('takes the next row only when the first is taken and there is one', () => {
    const boxes = [box('new', 150, 100), box('old', 100, 100)];

    expect(rowsOf(placeNames(boxes, 600, 1))).toEqual({ new: 0 });
    expect(rowsOf(placeNames(boxes, 600, 2))).toEqual({ new: 0, old: 1 });
    // A name with room beside the newer one stays in the first row.
    expect(rowsOf(placeNames([box('new', 150, 100), box('older', 0, 90)], 600, 2))).toEqual({
      new: 0,
      older: 0,
    });
  });

  it('keeps a lower row clear of the rule a higher row’s name runs down to the strip', () => {
    // `old` sits in the second row at 100; its rule crosses the first row at 100, so `older`
    // (0 to 120) cannot sit in the first row across it, nor in the second beside `old`.
    const boxes = [box('new', 150, 100), box('old', 100, 100), box('older', 0, 120)];

    expect(rowsOf(placeNames(boxes, 600, 2))).toEqual({ new: 0, old: 1 });
    expect(rowsOf(placeNames(boxes, 600, 3))).toEqual({ new: 0, old: 1, older: 2 });
  });

  it('draws a name wider than its run, from the run’s start', () => {
    expect(placeNames([box('wide', 200, 300)], 600, 1).get('wide')).toEqual({
      key: 'wide',
      x: 200,
      row: 0,
    });
  });

  it('holds a name back from the strip’s right end, and at its left end when wider than it', () => {
    expect(placeNames([box('late', 560, 150)], 600, 1).get('late')?.x).toBe(450);
    expect(placeNames([box('huge', 100, 800)], 600, 1).get('huge')?.x).toBe(0);
  });

  it('keeps a name in its row while it still fits there, so a scrolling strip does not jitter', () => {
    // `old` went to the second row; the first row now has room for it, but it stays where it was.
    const before = new Map([['old', 1]]);
    expect(
      rowsOf(placeNames([box('new', 300, 100), box('old', 100, 100)], 600, 2, before)),
    ).toEqual({ new: 0, old: 1 });
    // A row it no longer fits in, or one there is no longer, gives it the first that has room.
    const crowded = [box('new', 150, 100), box('old', 100, 100)];
    expect(rowsOf(placeNames(crowded, 600, 2, new Map([['old', 0]])))).toEqual({ new: 0, old: 1 });
    expect(rowsOf(placeNames([box('old', 100, 100)], 600, 1, before))).toEqual({ old: 0 });
  });

  it('places nothing in a strip without a width or without rows', () => {
    expect(placeNames([box('a', 0, 50)], 0, 1).size).toBe(0);
    expect(placeNames([box('a', 0, 50)], 600, 0).size).toBe(0);
  });
});
