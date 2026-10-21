/**
 * localStorage that never throws. Storage can be unavailable (privacy modes, disabled site data,
 * sandboxed frames) or full; preferences then simply do not persist instead of breaking the app.
 * Internal to the kit: not part of the public API.
 */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not persisted; the in-memory state still applies for this session.
    }
  },
};
