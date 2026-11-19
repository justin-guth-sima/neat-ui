/**
 * A length of time in the kit's style: "42 s", "5 min 07 s", "2 h 05 min", "3 d 04 h".
 *
 * ```ts
 * neatDuration(stats.uptime_s); // "2 h 05 min"
 * ```
 *
 * It says seconds under a minute, then minutes and seconds, hours and minutes, and from 24 h days
 * and hours. The second unit always has two digits, so a running time keeps its width.
 *
 * Each unit is cut to whole units, as a clock shows them: 59.9 s is "59 s", and a minute is shown
 * only once it has passed. So a running time counts up as a stopwatch does.
 *
 * Anything that is not a finite number of at least 0 is "–": `null`, `undefined`, `NaN`, an
 * infinity, a negative number, or a value of another type that came in from JSON. A page can pass
 * a field it has not checked and show the dash, as `NeatEasedNumber` does while it has no value.
 *
 * For how long ago something was, `neatSecondsAgo` is the kit's style ("3 min ago").
 */
export function neatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '–';
  const whole = Math.floor(seconds);
  if (whole < 60) return `${whole} s`;
  const minutes = Math.floor(whole / 60);
  if (minutes < 60) return `${minutes} min ${pad(whole % 60)} s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${pad(minutes % 60)} min`;
  return `${Math.floor(hours / 24)} d ${pad(hours % 24)} h`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
