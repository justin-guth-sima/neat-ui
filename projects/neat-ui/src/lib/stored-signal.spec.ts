import { neatStoredSignal } from './stored-signal';

const KEY = 'neat-ui:stored-signal-spec';

/** Accepts a whole number from 0 to 10, as an app's own check of what it stored would. */
const level = (stored: unknown): number | undefined =>
  typeof stored === 'number' && Number.isInteger(stored) && stored >= 0 && stored <= 10
    ? stored
    : undefined;

describe('neatStoredSignal', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts at its initial value when nothing is stored', () => {
    expect(neatStoredSignal(KEY, 3, level)()).toBe(3);
  });

  it('starts at its initial value when the stored text is not JSON', () => {
    localStorage.setItem(KEY, '{not json');

    expect(neatStoredSignal(KEY, 3, level)()).toBe(3);
  });

  it('starts at its initial value when parse refuses what is stored', () => {
    localStorage.setItem(KEY, '42');

    expect(neatStoredSignal(KEY, 3, level)()).toBe(3);
  });

  it('starts at what is stored, as parse gives it back', () => {
    localStorage.setItem(KEY, '{"show":true,"extra":1}');
    const parse = vi.fn((stored: unknown) =>
      typeof stored === 'object' && stored !== null && 'show' in stored
        ? { show: stored.show === true }
        : undefined,
    );

    expect(neatStoredSignal(KEY, { show: false }, parse)()).toEqual({ show: true });
    expect(parse).toHaveBeenCalledExactlyOnceWith({ show: true, extra: 1 });
  });

  it('keeps a set value for a new signal on the same key', () => {
    const first = neatStoredSignal(KEY, 3, level);

    first.set(7);

    expect(first()).toBe(7);
    expect(localStorage.getItem(KEY)).toBe('7');
    expect(neatStoredSignal(KEY, 3, level)()).toBe(7);
  });

  it('keeps an updated value for a new signal on the same key', () => {
    const first = neatStoredSignal(KEY, 3, level);

    first.update((value) => value + 2);

    expect(first()).toBe(5);
    expect(neatStoredSignal(KEY, 3, level)()).toBe(5);
  });

  it('works in memory when reading the storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const stored = neatStoredSignal(KEY, 3, level);

    expect(stored()).toBe(3);
    stored.set(4);
    expect(stored()).toBe(4);
  });

  it('works in memory when writing the storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const stored = neatStoredSignal(KEY, 3, level);

    expect(() => stored.set(4)).not.toThrow();
    expect(stored()).toBe(4);
    expect(() => stored.update((value) => value + 1)).not.toThrow();
    expect(stored()).toBe(5);
  });

  it('works in memory when the value cannot be written as JSON', () => {
    const stored = neatStoredSignal<unknown>(KEY, null, (value) => value);
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;

    expect(() => stored.set(cyclic)).not.toThrow();
    expect(stored()).toBe(cyclic);
  });
});
