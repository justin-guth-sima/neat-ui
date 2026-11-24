/** How `neatDuration` says a length of time. */
export interface NeatDurationOptions {
  /**
   * Tenths of a second under a minute ("34.4 s", "0.8 s"), for a length read closely, such as a
   * run's; a minute and more read as without it. Off by default.
   */
  readonly tenths?: boolean;
}

/**
 * A length of time in the kit's style: "42 s", "5 min 07 s", "2 h 05 min", "3 d 04 h".
 *
 * ```ts
 * neatDuration(stats.uptime_s); // "2 h 05 min"
 * ```
 *
 * It says seconds under a minute, then minutes and seconds, hours and minutes, and from 24 h days
 * and hours. The second unit always has two digits, as a clock shows it ("5 min 07 s").
 *
 * Each unit is cut to whole units, as a clock shows them: 59.9 s is "59 s", and a minute is shown
 * only once it has passed. So a running time counts up as a stopwatch does.
 *
 * Anything that is not a finite number of at least 0 is "–": `null`, `undefined`, `NaN`, an
 * infinity, a negative number, or a value of another type that came in from JSON. A page can pass
 * a field it has not checked and show the dash, as `NeatEasedNumber` does while it has no value.
 *
 * With `{ tenths: true }` it says tenths of a second under a minute, cut as a clock does: 34.39 s
 * is "34.3 s", 59.99 s is "59.9 s", and 0 is "0.0 s". A minute and more read the same either way.
 *
 * For how long ago something was, `neatSecondsAgo` is the kit's style ("3 min ago").
 */
export function neatDuration(
  seconds: number | null | undefined,
  options: NeatDurationOptions = {},
): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '–';
  const whole = Math.floor(seconds);
  if (whole < 60) return options.tenths ? `${cutToTenths(seconds).toFixed(1)} s` : `${whole} s`;
  const minutes = Math.floor(whole / 60);
  if (minutes < 60) return `${minutes} min ${pad(whole % 60)} s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${pad(minutes % 60)} min`;
  return `${Math.floor(hours / 24)} d ${pad(hours % 24)} h`;
}

/**
 * Cut to tenths, never up: 34.39 is 34.3. The nudge keeps a tenth that floating point stores a hair
 * low (34.4 as 343.99999… tenths) from losing it.
 */
function cutToTenths(seconds: number): number {
  return Math.floor(seconds * 10 + 1e-9) / 10;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
