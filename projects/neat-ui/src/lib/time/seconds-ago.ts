/**
 * How long ago something was, in the kit's one relative-time style: "just now", "12 s ago".
 *
 * ```ts
 * neatSecondsAgo((Date.now() - lastSeen) / 1000); // "3 min ago"
 * ```
 *
 * It says "just now" under 10 s, then "12 s ago", "3 min ago", "2 h ago" and "4 d ago". Each is cut
 * to whole units: a minute is 60 whole seconds, an hour 60 minutes.
 *
 * `seconds` is first rounded to a whole second. A time ahead of now, from a clock that stepped
 * back, reads as "just now".
 *
 * This is the one place the words and thresholds live, so a page that parses a timestamp and the
 * charts' readout cannot say the same age two ways.
 */
export function neatSecondsAgo(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < 10) return 'just now';
  if (whole < 60) return `${whole} s ago`;
  if (whole < 3600) return `${Math.floor(whole / 60)} min ago`;
  if (whole < 86_400) return `${Math.floor(whole / 3600)} h ago`;
  return `${Math.floor(whole / 86_400)} d ago`;
}
