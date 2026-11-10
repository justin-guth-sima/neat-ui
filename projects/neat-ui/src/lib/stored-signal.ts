import { signal, untracked, type WritableSignal } from '@angular/core';
import { safeStorage } from './storage';

/**
 * A signal kept in localStorage, for a setting an app remembers per browser.
 *
 * ```ts
 * readonly bars = neatStoredSignal('my-app:bars', true, (stored) =>
 *   typeof stored === 'boolean' ? stored : undefined,
 * );
 * ```
 *
 * Use it for a panel's choices or a view's options. It needs no injection context.
 *
 * It starts at what is stored under `key`, as `parse` accepts it. `parse` gets the stored JSON, of
 * any shape an older version of the app may have written. It answers the value, or undefined to
 * refuse it. Nothing stored, text that is not JSON, or a refusal starts the signal at `initial`.
 *
 * `set` and `update` store the new value as JSON. Storage that is missing, refuses or cannot hold
 * the value never throws: the signal then holds its value for this page load only.
 */
export function neatStoredSignal<T>(
  key: string,
  initial: T,
  parse: (stored: unknown) => T | undefined,
): WritableSignal<T> {
  const value = signal(read(key, parse) ?? initial);
  const set = value.set;
  // The signal itself, with its writes stored: it stays a real signal (`isSignal`, `asReadonly`).
  value.set = (next: T) => {
    set(next);
    write(key, next);
  };
  value.update = (change: (current: T) => T) => value.set(change(untracked(value)));
  return value;
}

function read<T>(key: string, parse: (stored: unknown) => T | undefined): T | undefined {
  const text = safeStorage.get(key);
  if (text === null) return undefined;
  let stored: unknown;
  try {
    stored = JSON.parse(text);
  } catch {
    return undefined; // Not JSON: as if nothing were stored.
  }
  return parse(stored);
}

function write(key: string, value: unknown): void {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    return; // Not JSON (a cycle, a BigInt): kept in memory only, as with storage that refuses.
  }
  safeStorage.set(key, text);
}
