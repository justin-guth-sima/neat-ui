/*
 * A short, stable name for a generated value, for the specs that pin what a seed generates: a
 * change anywhere in a diagram or a message sequence changes it, and a spec can hold a few
 * characters where the whole value would be pages.
 */

/** FNV-1a (32-bit) over the value's JSON, as 8 hex digits. */
export function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
