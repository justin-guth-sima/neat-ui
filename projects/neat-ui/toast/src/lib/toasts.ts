import { inject, Injectable } from '@angular/core';
import { ToastStore } from './toast-store';

/** A toast for work that takes a while, as `NeatToasts.progress` returns it. */
export interface NeatProgressToast {
  /**
   * Shows how far the work is: a line of detail ("clip.mp4 · file 1 of 3") and a percent from 0 to
   * 100, or `null` while it cannot say. Values outside the range are held to it.
   */
  update(detail: string, percent: number | null): void;
  /** The work succeeded: the toast becomes a status toast with this message. */
  done(message: string): void;
  /** The work failed: the toast becomes an error toast with this message. */
  fail(message: string): void;
  /**
   * Removes the toast with no outcome: the work did not end, it is reported elsewhere now (a dialog
   * that took it back). Nothing is announced. After it, and after `done` or `fail`, the handle
   * does nothing.
   */
  dismiss(): void;
}

/**
 * Short messages the app shows without taking the user's attention from what they are doing:
 *
 * ```ts
 * this.toasts.error('Could not start src3.');
 * this.toasts.warning('Uploaded clip.mp4, but could not restart src2.');
 * this.toasts.status('Stopped 2 sources.');
 * const upload = this.toasts.progress('Uploading 3 files');
 * upload.update('clip.mp4 · file 1 of 3', 41);
 * upload.done('Uploaded 3 files.');
 * ```
 *
 * An error or warning toast clears after 4.6 seconds and a status toast after 3.2. A progress toast
 * stays until `done` or `fail` turns it into an error or a status, so work that outlives the page
 * or dialog that started it keeps reporting, or until `dismiss` removes it. They show in the `<neat-toast-host>` the app renders once.
 * There is no toast without a host: the app must render one, or nothing is shown.
 *
 * Toasts do not hold the kiosk toolbar: they are not part of the floating chrome, and they
 * clear on their own.
 */
@Injectable({ providedIn: 'root' })
export class NeatToasts {
  private readonly store = inject(ToastStore);

  /** Reports a failure. */
  error(message: string): void {
    this.store.show('error', message);
  }

  /**
   * Reports something that went partly wrong or needs the user's notice, short of a failure: the
   * upload went through, but a slot using the file could not restart.
   */
  warning(message: string): void {
    this.store.show('warning', message);
  }

  /** Reports what happened: the result of an action. */
  status(message: string): void {
    this.store.show('status', message);
  }

  /** Starts a toast for work in progress, named by `title`: "Uploading 3 files". */
  progress(title: string): NeatProgressToast {
    const id = this.store.startProgress(title);
    return {
      update: (detail, percent) => this.store.updateProgress(id, detail, percent),
      done: (message) => this.store.settleProgress(id, 'status', message),
      fail: (message) => this.store.settleProgress(id, 'error', message),
      dismiss: () => this.store.remove(id),
    };
  }
}
