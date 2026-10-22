import { OVERLAY_NEUTRAL_COLOR, OVERLAY_PALETTE } from '../../theme/overlay-palette';
import { SIMA_PALETTE } from '../../theme/palette';
import { createColorAllocator, NeatOverlayColors, RELEASE_AFTER_MS, resolveColor } from './colors';

const PALETTE = OVERLAY_PALETTE;

describe('colour allocator', () => {
  it('keeps the same color for the same identity and differs across identities', () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    const first = allocator.colorFor(0, 'track', '7', 1);
    const second = allocator.colorFor(0, 'track', '8', 2);
    expect(first).not.toBe(second);
    expect(allocator.colorFor(0, 'track', '7', 3)).toBe(first);
    expect(
      allocator.colorFor(0, 'track', 7, 4),
      'numeric and string ids are the same identity',
    ).toBe(first);
  });

  it('keeps maps separate per namespace, and track and pose maps per channel', () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    expect(allocator.colorFor(0, 'track', '1', 1)).toBe(PALETTE[0]);
    expect(allocator.colorFor(1, 'track', 'x', 1)).toBe(PALETTE[0]);
    expect(allocator.colorFor(0, 'pose', 'y', 1)).toBe(PALETTE[0]);
    expect(allocator.colorFor(1, 'pose', 'z', 1)).toBe(PALETTE[0]);
    expect(allocator.colorFor(0, 'class', 'person', 1)).toBe(PALETTE[0]);
    expect(allocator.colorFor(0, 'class', 'car', 1)).toBe(PALETTE[1]);
  });

  it('gives a class the same color on every channel, whichever tile sees it first', () => {
    // Each viewer tile owns its allocator; classes must still agree across tiles.
    const colors = new NeatOverlayColors();
    const tile0 = createColorAllocator(colors);
    const tile3 = createColorAllocator(colors);
    const light = tile0.colorFor(0, 'class', 'traffic light', 1);
    tile0.colorFor(0, 'class', 'car', 1);
    const bicycle = tile3.colorFor(3, 'class', 'bicycle', 2);
    expect(bicycle, 'bicycle takes the next free slot, not the first one of channel 3').toBe(
      PALETTE[2],
    );
    expect(tile3.colorFor(3, 'class', 'traffic light', 3)).toBe(light);
    expect(tile0.colorFor(0, 'class', 'bicycle', 4)).toBe(bicycle);
    expect(tile3.size(3, 'class')).toBe(3);
  });

  it('keeps a class seen on another channel live there', () => {
    const colors = new NeatOverlayColors();
    const tile0 = createColorAllocator(colors);
    const tile1 = createColorAllocator(colors);
    const size = PALETTE.length;
    const seen: string[] = [];
    for (let i = 0; i < size; i += 1) seen.push(tile0.colorFor(0, 'class', `c${i}`, 0));
    const later = RELEASE_AFTER_MS + 100;
    // Channel 1 keeps drawing c0; channel 0 has not drawn anything since.
    tile1.colorFor(1, 'class', 'c0', later);
    expect(
      tile0.colorFor(0, 'class', 'new', later),
      'c0 is live on channel 1 and keeps its slot',
    ).not.toBe(seen[0]);
    expect(tile1.colorFor(1, 'class', 'c0', later + 1)).toBe(seen[0]);
  });

  it("hands a stale identity's slot to a newcomer, the one absent longest first", () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    const size = PALETTE.length;
    const seen: string[] = [];
    for (let i = 0; i < size; i += 1) {
      seen.push(allocator.colorFor(0, 'track', `t${i}`, i));
    }
    const later = size + RELEASE_AFTER_MS + 1;
    // Refresh t0 so it is live; t1..t39 are stale, t1 the longest.
    allocator.colorFor(0, 'track', 't0', later);
    const newcomer = allocator.colorFor(0, 'track', 'new', later);
    expect(newcomer, 'newcomer takes the slot of the stale identity absent longest, t1').toBe(
      seen[1],
    );
    expect(allocator.colorFor(0, 'track', 't0', later + 1), 'live identity keeps its color').toBe(
      seen[0],
    );
    expect(
      allocator.colorFor(0, 'track', 't1', later + 2),
      "released t1 returns as a newcomer and takes the next stale slot, t2's",
    ).toBe(seen[2]);
    expect(allocator.size(0, 'track')).toBe(size);
  });

  it('never takes a slot from a live identity; the newcomer shares one instead', () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    const size = PALETTE.length;
    const seen: string[] = [];
    for (let i = 0; i < size; i += 1) seen.push(allocator.colorFor(0, 'track', `t${i}`, i));
    const first = allocator.colorFor(0, 'track', 'new1', size);
    const second = allocator.colorFor(0, 'track', 'new2', size + 1);
    expect(PALETTE.includes(first)).toBe(true);
    expect(first, 'newcomers spread over different shared slots').not.toBe(second);
    for (let i = 0; i < size; i += 1) {
      expect(allocator.colorFor(0, 'track', `t${i}`, size + 2), `t${i} keeps its color`).toBe(
        seen[i],
      );
    }
    expect(
      allocator.colorFor(0, 'track', 'new1', size + 3),
      'a sharing newcomer keeps its color too',
    ).toBe(first);
    expect(allocator.size(0, 'track')).toBe(size + 2);
  });

  it('does not recolor a full frame when one identity is swapped for another', () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    const size = PALETTE.length;
    const seen: string[] = [];
    for (let i = 0; i < size; i += 1) seen.push(allocator.colorFor(0, 'track', `c${i}`, 0));
    // Next frame: c39 is gone, a newcomer is drawn before everyone else.
    const frame = ['new', ...Array.from({ length: size - 1 }, (_, i) => `c${i}`)];
    const drawn = frame.map((id) => allocator.colorFor(0, 'track', id, 33));
    expect(drawn.slice(1), 'no visible identity changes color').toStrictEqual(
      seen.slice(0, size - 1),
    );
    // Frames keep coming; once c39 has been absent long enough, the next newcomer gets its slot.
    let now = 33;
    while (now < RELEASE_AFTER_MS + 100) {
      now += 33;
      frame.forEach((id) => allocator.colorFor(0, 'track', id, now));
    }
    expect(allocator.colorFor(0, 'track', 'new2', now)).toBe(seen[size - 1]);
  });

  it('drops stale identities that share a slot, so the map stays bounded', () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    const size = PALETTE.length;
    for (let i = 0; i < size; i += 1) allocator.colorFor(0, 'track', `t${i}`, 0);
    for (let i = 0; i < 10; i += 1) allocator.colorFor(0, 'track', `s${i}`, 1);
    expect(allocator.size(0, 'track')).toBe(size + 10);
    const later = RELEASE_AFTER_MS + 100;
    for (let i = 0; i < size; i += 1) allocator.colorFor(0, 'track', `t${i}`, later);
    allocator.colorFor(0, 'track', 'x', later);
    expect(allocator.size(0, 'track'), 'the ten stale sharers are gone, x shares a slot').toBe(
      size + 1,
    );
  });

  it('separates two stale identities that shared a slot when they return', () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    const size = PALETTE.length;
    for (let i = 0; i < size; i += 1) allocator.colorFor(0, 'track', `t${i}`, 0);
    const shared = allocator.colorFor(0, 'track', 's', 1);
    expect(shared, "s shares t0's slot").toBe(PALETTE[0]);
    const later = RELEASE_AFTER_MS + 100;
    expect(allocator.colorFor(0, 'track', 't0', later), 'the first to return keeps the slot').toBe(
      PALETTE[0],
    );
    const returned = allocator.colorFor(0, 'track', 's', later + 1);
    expect(returned, 's is allocated afresh').not.toBe(PALETTE[0]);
    expect(returned, 'and takes the slot of the stale identity absent longest').toBe(PALETTE[1]);
  });

  it('reallocates a stale identity returning to a slot a live identity holds', () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    const size = PALETTE.length;
    for (let i = 0; i < size; i += 1) allocator.colorFor(0, 'track', `t${i}`, 0);
    allocator.colorFor(0, 'track', 's', 1);
    const later = RELEASE_AFTER_MS + 100;
    for (let i = 1; i < size; i += 1) allocator.colorFor(0, 'track', `t${i}`, later);
    expect(allocator.colorFor(0, 'track', 's', later), 's is live and keeps slot 0').toBe(
      PALETTE[0],
    );
    const t0 = allocator.colorFor(0, 'track', 't0', later + 1);
    expect(PALETTE.includes(t0), 't0 is allocated afresh').toBe(true);
    expect(allocator.colorFor(0, 'track', 's', later + 2), 's keeps slot 0').toBe(PALETTE[0]);
    expect(allocator.size(0, 'track'), 't0 shares a slot since none is free or stale').toBe(
      size + 1,
    );
  });

  it('records lastSeen independently per channel and namespace', () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    allocator.colorFor(1, 'class', 'far-future', 10 * RELEASE_AFTER_MS);
    const size = PALETTE.length;
    for (let i = 0; i < size; i += 1) allocator.colorFor(0, 'track', `t${i}`, i);
    const later = size + RELEASE_AFTER_MS + 1;
    const refreshed = allocator.colorFor(0, 'track', 't0', later);
    allocator.colorFor(0, 'track', 'new', later + 1);
    expect(
      allocator.colorFor(0, 'track', 't0', later + 2),
      't0 survived because its refresh was recorded despite a larger now on another channel',
    ).toBe(refreshed);
  });

  it('shares the slots inserted first when every identity is live', () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    const size = PALETTE.length;
    const seen: string[] = [];
    for (let i = 0; i < size + 5; i += 1) {
      seen.push(allocator.colorFor(0, 'track', `t${i}`, 42));
    }
    // The last `size` identities must be pairwise distinct.
    expect(new Set(seen.slice(5)).size).toBe(size);
    // t40..t44 share the slots of t0..t4; everyone keeps their color.
    expect(allocator.colorFor(0, 'track', 't0', 43)).toBe(PALETTE[0]);
    expect(allocator.colorFor(0, 'track', 't40', 43)).toBe(PALETTE[0]);
    expect(allocator.colorFor(0, 'track', 't5', 43)).toBe(PALETTE[5]);
  });

  it('clear drops its track and pose state but keeps the shared class colors', () => {
    const colors = new NeatOverlayColors();
    const allocator = createColorAllocator(colors);
    const other = createColorAllocator(colors);
    allocator.colorFor(0, 'track', 'a', 1);
    allocator.colorFor(0, 'track', 'b', 2);
    allocator.colorFor(0, 'class', 'person', 2);
    const car = other.colorFor(1, 'class', 'car', 2);
    allocator.clear();
    expect(allocator.size(0, 'track')).toBe(0);
    expect(allocator.colorFor(0, 'track', 'b', 3)).toBe(PALETTE[0]);
    expect(
      allocator.colorFor(0, 'class', 'person', 3),
      'a reconnecting tile keeps its class colors',
    ).toBe(PALETTE[0]);
    expect(other.colorFor(1, 'class', 'car', 3), 'other tiles keep theirs').toBe(car);
  });

  it('resolveColor prefers overrides, then neutral for a missing identity, then the allocator', () => {
    const allocator = createColorAllocator(new NeatOverlayColors());
    const personColor = SIMA_PALETTE.orange;
    const defaultColor = SIMA_PALETTE.blue;
    const base = { allocator, channelIndex: 0, namespace: 'class', now: 1 } as const;
    expect(resolveColor({ ...base, identity: 'person', overrides: { person: personColor } })).toBe(
      personColor,
    );
    expect(resolveColor({ ...base, identity: 'dog', overrides: { default: defaultColor } })).toBe(
      defaultColor,
    );
    expect(resolveColor({ ...base, identity: null, overrides: {} })).toBe(OVERLAY_NEUTRAL_COLOR);
    expect(resolveColor({ ...base, identity: null, overrides: { default: defaultColor } })).toBe(
      defaultColor,
    );
    expect(resolveColor({ ...base, identity: undefined })).toBe(OVERLAY_NEUTRAL_COLOR);
    expect(resolveColor({ ...base, identity: '' })).toBe(OVERLAY_NEUTRAL_COLOR);
    expect(resolveColor({ ...base, identity: 'cat' })).toBe(PALETTE[0]);
    expect(resolveColor({ ...base, identity: 'cat', overrides: { person: personColor } })).toBe(
      PALETTE[0],
    );
    expect(allocator.size(0, 'class'), 'overridden identities do not consume palette slots').toBe(
      1,
    );
  });

  it('two NeatOverlayColors instances do not share class colours', () => {
    const page = createColorAllocator(new NeatOverlayColors());
    const otherPage = createColorAllocator(new NeatOverlayColors());
    expect(page.colorFor(0, 'class', 'car', 1)).toBe(PALETTE[0]);
    expect(page.colorFor(0, 'class', 'person', 1)).toBe(PALETTE[1]);
    expect(otherPage.colorFor(0, 'class', 'person', 1), 'person is new to the other page').toBe(
      PALETTE[0],
    );
    expect(otherPage.size(0, 'class')).toBe(1);
  });
});
