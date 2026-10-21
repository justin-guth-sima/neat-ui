import { safeStorage } from './storage';

describe('safeStorage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('stores and reads back a value', () => {
    safeStorage.set('neat-ui:test', 'value');
    expect(safeStorage.get('neat-ui:test')).toBe('value');
    expect(localStorage.getItem('neat-ui:test')).toBe('value');
  });

  it('answers null for a missing key', () => {
    expect(safeStorage.get('neat-ui:missing')).toBeNull();
  });

  it('answers null when reading throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(safeStorage.get('neat-ui:test')).toBeNull();
  });

  it('swallows a failing write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => safeStorage.set('neat-ui:test', 'value')).not.toThrow();
  });
});
