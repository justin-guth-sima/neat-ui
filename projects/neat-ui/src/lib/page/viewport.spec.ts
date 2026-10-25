import { TestBed } from '@angular/core/testing';
import { NeatViewport } from './viewport';

/** A `matchMedia` stub that keeps its `change` listeners, so a test can fire one. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const list = {
    matches,
    addEventListener: vi.fn((_type: string, listener: (event: { matches: boolean }) => void) =>
      listeners.add(listener),
    ),
    removeEventListener: vi.fn((_type: string, listener: (event: { matches: boolean }) => void) =>
      listeners.delete(listener),
    ),
  };
  const matchMedia = vi.fn(() => list);
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    matchMedia,
    list,
    fire: (next: boolean) => listeners.forEach((listener) => listener({ matches: next })),
  };
}

describe('NeatViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for a width below 48rem, the breakpoint the kit states once', () => {
    const { matchMedia } = stubMatchMedia(false);

    TestBed.inject(NeatViewport);

    expect(matchMedia).toHaveBeenCalledExactlyOnceWith('(width < 48rem)');
  });

  it('is narrow while the query matches, from the start and after a change', () => {
    const media = stubMatchMedia(true);
    const viewport = TestBed.inject(NeatViewport);
    expect(viewport.narrow()).toBe(true);

    media.fire(false);
    expect(viewport.narrow()).toBe(false);

    media.fire(true);
    expect(viewport.narrow()).toBe(true);
  });

  it('is not narrow at the start when the query does not match', () => {
    stubMatchMedia(false);

    expect(TestBed.inject(NeatViewport).narrow()).toBe(false);
  });

  it('stops listening when it is destroyed', () => {
    const media = stubMatchMedia(false);
    TestBed.inject(NeatViewport);

    TestBed.resetTestingModule();

    expect(media.list.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('is not narrow where matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(TestBed.inject(NeatViewport).narrow()).toBe(false);
  });
});
