import { TestBed } from '@angular/core/testing';
import { KIOSK_POINTER_IDLE_MS, KioskService } from './kiosk.service';

const root = document.documentElement;

/**
 * jsdom has no Fullscreen API. This installs a stand-in on the real document: `request` and
 * `exit` behave like a browser that grants the call (the element changes, then
 * `fullscreenchange` fires, then the promise resolves) unless a test makes them reject.
 */
function installFullscreen() {
  let element: Element | null = null;
  const change = (next: Element | null) => {
    element = next;
    document.dispatchEvent(new Event('fullscreenchange'));
  };
  const request = vi.fn(async () => change(root));
  const exit = vi.fn(async () => change(null));
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => element,
  });
  Object.defineProperty(root, 'requestFullscreen', { configurable: true, value: request });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
  return {
    request,
    exit,
    /** Fullscreen changing without the service asking: Esc, F11-style UI, a video element. */
    userAgentChange: change,
  };
}

function removeFullscreen(): void {
  Reflect.deleteProperty(document, 'fullscreenElement');
  Reflect.deleteProperty(document, 'exitFullscreen');
  Reflect.deleteProperty(root, 'requestFullscreen');
}

function startAt(url: string): KioskService {
  history.replaceState(null, '', url);
  return TestBed.inject(KioskService);
}

describe('KioskService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    removeFullscreen();
    history.replaceState(null, '', '/');
  });

  it('starts active when the URL has ?kiosk (and not ?kiosk=0 or ?kiosk=false)', () => {
    const cases: [string, boolean][] = [
      ['/?kiosk', true],
      ['/?kiosk=1', true],
      ['/?kiosk=true', true],
      ['/viewer?layout=grid&kiosk', true],
      ['/', false],
      ['/?kiosk=0', false],
      ['/?kiosk=false', false],
      ['/?notkiosk', false],
    ];

    for (const [url, active] of cases) {
      TestBed.resetTestingModule();
      expect(startAt(url).active(), url).toBe(active);
    }
  });

  it('starts active from ?kiosk even when requestFullscreen rejects, without throwing', () => {
    const fullscreen = installFullscreen();
    fullscreen.request.mockRejectedValue(new TypeError('Permissions check failed'));

    const kiosk = startAt('/?kiosk');

    expect(kiosk.active()).toBe(true);
    // Browsers refuse fullscreen without a user gesture, so the URL parameter never asks.
    expect(fullscreen.request).not.toHaveBeenCalled();
  });

  it('enter() activates and requests fullscreen; a rejection leaves it active', async () => {
    const fullscreen = installFullscreen();
    fullscreen.request.mockRejectedValue(new TypeError('Permissions check failed'));
    const kiosk = startAt('/');
    expect(kiosk.active()).toBe(false);

    await expect(kiosk.enter()).resolves.toBeUndefined();

    expect(fullscreen.request).toHaveBeenCalledOnce();
    expect(kiosk.active()).toBe(true);
  });

  it('enter() and exit() work without the Fullscreen API', async () => {
    const kiosk = startAt('/');

    await expect(kiosk.enter()).resolves.toBeUndefined();
    expect(kiosk.active()).toBe(true);

    await expect(kiosk.exit()).resolves.toBeUndefined();
    expect(kiosk.active()).toBe(false);
  });

  it('leaving fullscreen exits kiosk only if enter() obtained fullscreen', async () => {
    const fullscreen = installFullscreen();

    // Booted from the URL: fullscreen coming and going (a video element, say) is not ours.
    const booted = startAt('/?kiosk');
    fullscreen.userAgentChange(root);
    fullscreen.userAgentChange(null);
    expect(booted.active()).toBe(true);

    // enter() was refused: leaving some other fullscreen keeps kiosk on.
    TestBed.resetTestingModule();
    const refused = startAt('/');
    fullscreen.request.mockRejectedValueOnce(new TypeError('Permissions check failed'));
    await refused.enter();
    fullscreen.userAgentChange(root);
    fullscreen.userAgentChange(null);
    expect(refused.active()).toBe(true);

    // enter() obtained fullscreen: leaving it (Esc) leaves kiosk too.
    TestBed.resetTestingModule();
    const granted = startAt('/');
    await granted.enter();
    expect(granted.active()).toBe(true);
    fullscreen.userAgentChange(null);
    expect(granted.active()).toBe(false);
  });

  it('exit() leaves fullscreen only when enter() obtained it, and never throws', async () => {
    const fullscreen = installFullscreen();

    const granted = startAt('/');
    await granted.enter();
    await granted.exit();
    expect(fullscreen.exit).toHaveBeenCalledOnce();
    expect(granted.active()).toBe(false);

    // Fullscreen held by something else while booted from the URL is left alone.
    TestBed.resetTestingModule();
    fullscreen.exit.mockClear();
    fullscreen.userAgentChange(root);
    const booted = startAt('/?kiosk');
    await booted.exit();
    expect(fullscreen.exit).not.toHaveBeenCalled();
    expect(booted.active()).toBe(false);
    fullscreen.userAgentChange(null);

    // A rejected exitFullscreen still leaves kiosk.
    TestBed.resetTestingModule();
    const rejected = startAt('/');
    await rejected.enter();
    fullscreen.exit.mockRejectedValueOnce(new TypeError('Not in fullscreen'));
    await expect(rejected.exit()).resolves.toBeUndefined();
    expect(rejected.active()).toBe(false);
  });

  it('toggle() enters and exits', async () => {
    const fullscreen = installFullscreen();
    const kiosk = startAt('/');

    await kiosk.toggle();
    expect(kiosk.active()).toBe(true);
    expect(fullscreen.request).toHaveBeenCalledOnce();

    await kiosk.toggle();
    expect(kiosk.active()).toBe(false);
    expect(fullscreen.exit).toHaveBeenCalledOnce();
  });

  it('pointerIdle turns true after 2500 ms without pointer or touch input and false on input', () => {
    vi.useFakeTimers();
    const kiosk = startAt('/');
    expect(KIOSK_POINTER_IDLE_MS).toBe(2500);
    expect(kiosk.pointerIdle()).toBe(false);

    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS - 1);
    expect(kiosk.pointerIdle()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(kiosk.pointerIdle()).toBe(true);

    for (const type of ['pointermove', 'pointerdown', 'touchstart']) {
      document.dispatchEvent(new Event(type));
      expect(kiosk.pointerIdle(), type).toBe(false);

      // Input while not idle restarts the countdown.
      vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS - 1);
      document.dispatchEvent(new Event(type));
      vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS - 1);
      expect(kiosk.pointerIdle(), type).toBe(false);
      vi.advanceTimersByTime(1);
      expect(kiosk.pointerIdle(), type).toBe(true);
    }
  });

  it('holdToolbar: pointerIdle stays false while held and counts down again from the last release', () => {
    vi.useFakeTimers();
    const kiosk = startAt('/');
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS);
    expect(kiosk.pointerIdle()).toBe(true);

    // A hold wakes an idle pointer and keeps it awake, whatever the input does meanwhile.
    const release = kiosk.holdToolbar();
    expect(kiosk.pointerIdle()).toBe(false);
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS * 4);
    document.dispatchEvent(new Event('pointermove'));
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS * 4);
    expect(kiosk.pointerIdle()).toBe(false);

    // Released, the pointer has to rest a full period again before it counts as idle.
    release();
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS - 1);
    expect(kiosk.pointerIdle()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(kiosk.pointerIdle()).toBe(true);
  });

  it('holdToolbar: two holds need two releases; a release called twice counts once', () => {
    vi.useFakeTimers();
    const kiosk = startAt('/');
    const first = kiosk.holdToolbar();
    const second = kiosk.holdToolbar();

    first();
    first();
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS * 2);
    expect(kiosk.pointerIdle()).toBe(false);

    second();
    vi.advanceTimersByTime(KIOSK_POINTER_IDLE_MS);
    expect(kiosk.pointerIdle()).toBe(true);
  });

  it('listens passively and removes its listeners and timer on destroy', () => {
    vi.useFakeTimers();
    const added = vi.spyOn(document, 'addEventListener');
    const removed = vi.spyOn(document, 'removeEventListener');
    startAt('/');

    const types = ['fullscreenchange', 'pointermove', 'pointerdown', 'touchstart'];
    const ours = added.mock.calls.filter(([type]) => types.includes(type));
    expect(ours.map(([type]) => type).sort()).toEqual([...types].sort());
    for (const [type, , options] of ours) {
      if (type !== 'fullscreenchange') {
        expect(options, type).toEqual({ passive: true });
      }
    }
    expect(vi.getTimerCount()).toBe(1);

    TestBed.resetTestingModule();

    const removedPairs = removed.mock.calls.map(([type, listener]) => [type, listener]);
    for (const [type, listener] of ours) {
      expect(removedPairs, type).toContainEqual([type, listener]);
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});
