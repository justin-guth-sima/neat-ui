import { DestroyRef, DOCUMENT, inject, Injectable, Signal, signal } from '@angular/core';

/** How long the pointer must rest before `KioskService.pointerIdle` turns true. */
export const KIOSK_POINTER_IDLE_MS = 2500;

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'touchstart'] as const;

/**
 * `?kiosk`, `?kiosk=1` and the like turn kiosk on; `?kiosk=0` and `?kiosk=false` leave it off,
 * so a link can switch it off explicitly.
 */
function kioskRequested(search: string): boolean {
  const value = new URLSearchParams(search).get('kiosk');
  return value !== null && value !== '0' && value !== 'false';
}

/**
 * Kiosk mode for expos: the shell hides its rail and top bar, and pages can hide their own chrome
 * while the pointer rests (`pointerIdle`). Kiosk keeps the current colour scheme and is not
 * persisted; it comes from the button or from a `?kiosk` URL parameter read once at start.
 *
 * `enter()` also asks for browser fullscreen. The URL parameter does not, because browsers refuse
 * fullscreen without a user gesture; booth machines use the browser's own kiosk flag instead.
 * If fullscreen was obtained by `enter()`, leaving it (Esc) leaves kiosk mode too.
 *
 * A component whose UI lives outside the floating chrome but belongs to it (a popover opened from
 * the page toolbar) holds the toolbar with `holdToolbar()`, so the chrome does not fade under it.
 *
 * The document listeners are plain DOM listeners outside change detection; signals change only
 * when the state does, so pointer movement does not cause renders.
 */
@Injectable({ providedIn: 'root' })
export class KioskService {
  private readonly document = inject(DOCUMENT);

  private readonly isActive = signal(kioskRequested(this.document.location?.search ?? ''));
  private readonly isPointerIdle = signal(false);

  /** Whether the current fullscreen is the one `enter()` asked for. */
  private ownsFullscreen = false;
  /** Unreleased `holdToolbar()` calls; the pointer never counts as idle while there are any. */
  private holds = 0;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

  readonly active: Signal<boolean> = this.isActive.asReadonly();
  /**
   * True once the pointer has rested for `KIOSK_POINTER_IDLE_MS`; false again on pointer or touch
   * input, and false throughout a `holdToolbar()`.
   */
  readonly pointerIdle: Signal<boolean> = this.isPointerIdle.asReadonly();

  constructor() {
    const onActivity = () => this.onActivity();
    const onFullscreenChange = () => this.onFullscreenChange();
    const passive: AddEventListenerOptions = { passive: true };

    this.document.addEventListener('fullscreenchange', onFullscreenChange);
    for (const type of ACTIVITY_EVENTS) {
      this.document.addEventListener(type, onActivity, passive);
    }
    this.restartIdleTimer();

    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('fullscreenchange', onFullscreenChange);
      for (const type of ACTIVITY_EVENTS) {
        this.document.removeEventListener(type, onActivity, passive);
      }
      clearTimeout(this.idleTimer);
    });
  }

  /** Turns kiosk on and asks for fullscreen; kiosk stays on if fullscreen is refused. */
  async enter(): Promise<void> {
    this.isActive.set(true);
    const root = this.document.documentElement;
    // Missing in some embedded browsers (and in jsdom); something else may already be fullscreen.
    if (typeof root.requestFullscreen !== 'function' || this.document.fullscreenElement) {
      return;
    }
    try {
      await root.requestFullscreen();
      this.ownsFullscreen = this.document.fullscreenElement === root;
    } catch {
      // Refused (no user gesture, permissions policy): kiosk without fullscreen.
    }
  }

  /** Turns kiosk off, leaving fullscreen only if `enter()` obtained it. */
  async exit(): Promise<void> {
    this.isActive.set(false);
    if (!this.ownsFullscreen) {
      return;
    }
    this.ownsFullscreen = false;
    if (!this.document.fullscreenElement || typeof this.document.exitFullscreen !== 'function') {
      return;
    }
    try {
      await this.document.exitFullscreen();
    } catch {
      // Fullscreen already ended on its own; nothing left to undo.
    }
  }

  toggle(): Promise<void> {
    return this.isActive() ? this.exit() : this.enter();
  }

  /**
   * Keeps `pointerIdle` false, so the kiosk chrome stays shown, until the returned function is
   * called. Holds stack: the pointer can go idle again only once every hold is released, and then
   * only after resting a full `KIOSK_POINTER_IDLE_MS`. Releasing twice counts once.
   */
  holdToolbar(): () => void {
    this.holds++;
    this.isPointerIdle.set(false);
    this.restartIdleTimer();
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.holds--;
      this.restartIdleTimer();
    };
  }

  private onFullscreenChange(): void {
    if (this.ownsFullscreen && !this.document.fullscreenElement) {
      this.ownsFullscreen = false;
      this.isActive.set(false);
    }
  }

  private onActivity(): void {
    if (this.isPointerIdle()) {
      this.isPointerIdle.set(false);
    }
    this.restartIdleTimer();
  }

  /** Starts the countdown to idle over; while the toolbar is held there is nothing to count. */
  private restartIdleTimer(): void {
    clearTimeout(this.idleTimer);
    if (this.holds === 0) {
      this.idleTimer = setTimeout(() => this.isPointerIdle.set(true), KIOSK_POINTER_IDLE_MS);
    }
  }
}
