import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const STORAGE_KEY = 'neat-ui:color-scheme';
const html = document.documentElement;

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    html.classList.remove('neat-dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    html.classList.remove('neat-dark');
  });

  it('starts light even when the OS prefers dark', () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMedia);

    const theme = TestBed.inject(ThemeService);

    expect(theme.scheme()).toBe('light');
    expect(html.classList.contains('neat-dark')).toBe(false);
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it('applies and persists dark under neat-ui:color-scheme', () => {
    const theme = TestBed.inject(ThemeService);

    theme.setScheme('dark');

    expect(theme.scheme()).toBe('dark');
    expect(html.classList.contains('neat-dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('switches back to light and persists it', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setScheme('dark');

    theme.setScheme('light');

    expect(html.classList.contains('neat-dark')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('toggles between the schemes', () => {
    const theme = TestBed.inject(ThemeService);

    theme.toggle();
    expect(theme.scheme()).toBe('dark');
    expect(html.classList.contains('neat-dark')).toBe(true);

    theme.toggle();
    expect(theme.scheme()).toBe('light');
    expect(html.classList.contains('neat-dark')).toBe(false);
  });

  it('restores the stored scheme on start', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');

    const theme = TestBed.inject(ThemeService);

    expect(theme.scheme()).toBe('dark');
    expect(html.classList.contains('neat-dark')).toBe(true);
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'sepia');

    expect(TestBed.inject(ThemeService).scheme()).toBe('light');
  });

  it('falls back to light when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    const theme = TestBed.inject(ThemeService);
    expect(theme.scheme()).toBe('light');

    theme.setScheme('dark');
    expect(theme.scheme()).toBe('dark');
    expect(html.classList.contains('neat-dark')).toBe(true);
  });

  it('setScheme(dark, {persist: false}) applies dark without writing storage; a later toggle persists as before', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const theme = TestBed.inject(ThemeService);

    theme.setScheme('dark', { persist: false });

    expect(theme.scheme()).toBe('dark');
    expect(html.classList.contains('neat-dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');

    theme.toggle();

    expect(theme.scheme()).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');

    theme.toggle();

    expect(theme.scheme()).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('leaves the stored scheme for the next page load when not persisting', () => {
    const theme = TestBed.inject(ThemeService);

    theme.setScheme('dark', { persist: false });
    TestBed.resetTestingModule();

    // A new page load starts from storage again, which the call left untouched.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(TestBed.inject(ThemeService).scheme()).toBe('light');
  });

  it('persists by default and with persist: true', () => {
    const theme = TestBed.inject(ThemeService);

    theme.setScheme('dark', { persist: true });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

    theme.setScheme('light', {});
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });
});
