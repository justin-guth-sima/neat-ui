// Extra Chromium flags for a flag-variant campaign (`--browser-flags`): judged before anything is
// launched, and again where the board's shell would read them, because the board runs a script
// with them in it. Pure.

/** `--name` or `--name=value`; a value is plain characters, so no shell can read one as syntax. */
const FLAG = /^--[A-Za-z][\w-]*(?:=[\w.,:+/@%=-]*)?$/;

/**
 * What the harness starts the browser with itself: a second `--remote-debugging-port` would move
 * the port it reads back, `--user-data-dir` would leave the run's profile (and its cleanup), and
 * the display flags would change what is being measured under the campaign's own name.
 */
const OWNED = [
  'remote-debugging-port',
  'remote-debugging-address',
  'remote-debugging-pipe',
  'user-data-dir',
  'headless',
  'kiosk',
  'window-position',
  'window-size',
];

/** The reason `flag` is not allowed, or null. */
export function browserFlagProblem(flag) {
  if (!FLAG.test(flag)) return `"${flag}" is not --name or --name=value of plain characters`;
  const name = flag.slice(2).split('=')[0];
  if (OWNED.includes(name)) return `${flag} is set by the harness itself`;
  return null;
}

/** The flags of `--browser-flags "<flags>"` as a list; throws an `Error` saying which is wrong. */
export function parseBrowserFlags(text) {
  if (text === undefined) return [];
  const tokens = text.split(/[ \t]+/).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error('--browser-flags is empty: give flags such as "--disable-gpu"');
  }
  for (const token of tokens) {
    const problem = browserFlagProblem(token);
    if (problem) throw new Error(`--browser-flags: ${problem}`);
  }
  return tokens;
}
