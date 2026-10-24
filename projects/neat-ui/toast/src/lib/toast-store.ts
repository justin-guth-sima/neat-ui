import { DestroyRef, inject, Injectable, signal, type Signal } from '@angular/core';

/** How long an error toast stays: long enough to read a sentence (#170's value). */
export const ERROR_TOAST_MS = 4600;
/** How long a status toast stays (#170's value). */
export const STATUS_TOAST_MS = 3200;
/** How long a warning toast stays: as long as an error, since it is read the same way. */
export const WARNING_TOAST_MS = ERROR_TOAST_MS;
/** The most toasts the host shows at once; the newest ones. */
export const MAX_VISIBLE_TOASTS = 3;

/** The kinds of toast that carry a message and clear on their own. */
export type MessageKind = 'error' | 'warning' | 'status';

/** How long each kind of message toast stays. */
const LIFETIMES: Record<MessageKind, number> = {
  error: ERROR_TOAST_MS,
  warning: WARNING_TOAST_MS,
  status: STATUS_TOAST_MS,
};

/** A toast the host shows. */
export type ToastEntry =
  | { readonly id: number; readonly kind: MessageKind; readonly message: string }
  | {
      readonly id: number;
      readonly kind: 'progress';
      readonly title: string;
      readonly detail: string;
      /** Whole percent, or `null` while the work cannot say how far along it is. */
      readonly percent: number | null;
    };

/**
 * The toasts the host shows: at most `MAX_VISIBLE_TOASTS`, oldest first. When there are more,
 * message toasts (error, warning, status) are hidden before progress toasts (oldest first in each
 * group): work in progress is what the user is waiting for, and it has no timer to clear it. The
 * newest toast is never hidden: a message that has just arrived is the news.
 */
export function visibleToasts(entries: readonly ToastEntry[]): readonly ToastEntry[] {
  let excess = entries.length - MAX_VISIBLE_TOASTS;
  if (excess <= 0) return entries;
  const hidden = new Set<number>();
  const newest = entries.at(-1);
  for (const transient of [true, false]) {
    for (const entry of entries) {
      if (excess > 0 && entry !== newest && (entry.kind !== 'progress') === transient) {
        hidden.add(entry.id);
        excess--;
      }
    }
  }
  return entries.filter((entry) => !hidden.has(entry.id));
}

/** A percent as the bar shows it: whole, within 0 to 100; `null` stays unknown. */
function wholePercent(percent: number | null): number | null {
  if (percent === null || !Number.isFinite(percent)) return null;
  return Math.round(Math.min(100, Math.max(0, percent)));
}

/**
 * The toasts that exist, oldest first, shared by `NeatToasts` (which adds them) and the host
 * (which shows them). Not exported by the entry: a toast is added through `NeatToasts`, and the
 * state stays out of its API.
 *
 * Message toasts clear themselves a fixed time after they are added, whether the host
 * shows them or newer toasts hide them: a toast is news for as long as it lives, and a hidden one
 * that waited for room would show its message late.
 */
@Injectable({ providedIn: 'root' })
export class ToastStore {
  private readonly state = signal<readonly ToastEntry[]>([]);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly entries: Signal<readonly ToastEntry[]> = this.state.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach((timer) => clearTimeout(timer)));
  }

  /** Adds a message toast as the newest, and clears it after its kind's time. */
  show(kind: MessageKind, message: string): void {
    const id = this.nextId++;
    this.state.update((entries) => [...entries, { id, kind, message }]);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.remove(id);
    }, LIFETIMES[kind]);
    this.timers.add(timer);
  }

  /** Adds a progress toast as the newest; it stays until settled or dismissed. Returns its id. */
  startProgress(title: string): number {
    const id = this.nextId++;
    this.state.update((entries) => [
      ...entries,
      { id, kind: 'progress', title, detail: '', percent: null },
    ]);
    return id;
  }

  /** Updates a progress toast that has not settled; does nothing for one that has. */
  updateProgress(id: number, detail: string, percent: number | null): void {
    this.state.update((entries) =>
      entries.map((entry) =>
        entry.id === id && entry.kind === 'progress'
          ? { ...entry, detail, percent: wholePercent(percent) }
          : entry,
      ),
    );
  }

  /**
   * Replaces a progress toast that has not settled with its outcome, as the newest toast: the
   * outcome is news even if newer toasts hid the progress. Does nothing for one that has settled.
   */
  settleProgress(id: number, kind: 'error' | 'status', message: string): void {
    if (!this.state().some((entry) => entry.id === id)) return;
    this.remove(id);
    this.show(kind, message);
  }

  /**
   * Removes a toast, with no outcome in its place. Ids are never reused, so removing one that has
   * already gone (a progress toast that settled into a new toast) does nothing.
   */
  remove(id: number): void {
    this.state.update((entries) => entries.filter((entry) => entry.id !== id));
  }
}
