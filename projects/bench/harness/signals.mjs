// What the harness does on Ctrl-C, SIGTERM and SIGHUP (design ruling D2). The first one starts
// the teardown, once. A teardown takes seconds and prints little until it ends, so a second Ctrl-C
// is a likely reflex: it only says what is going on. A third quits. Every ssh is detached from the
// terminal (`ssh.mjs`), so none of these reaches the board's scripts; a bare display's guard
// restores the board by itself once node is gone.

/**
 * A handler for those signals: `teardown()` (memoized by the caller) on the first, then `exit(130)`
 * when it ends; a message on the second (`guarded()`: whether a guard on the board finishes it);
 * `exit(130)` on the third. `abort(signal)` marks the campaign as cut off.
 */
export function interruptHandler({
  log,
  teardown,
  exit,
  guarded = () => false,
  abort = () => undefined,
}) {
  let count = 0;
  return (signal) => {
    count += 1;
    if (count === 1) {
      log(`${signal}: stopping what was started`);
      abort(signal);
      Promise.resolve()
        .then(teardown)
        .finally(() => exit(130));
    } else if (count === 2) {
      log(
        guarded()
          ? 'teardown in progress; the board restores itself if you quit'
          : 'teardown in progress; quitting now leaves on the board what it has not stopped yet',
      );
    } else {
      log(`${signal} again: quitting`);
      exit(130);
    }
  };
}
