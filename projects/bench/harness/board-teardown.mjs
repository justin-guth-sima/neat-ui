// The teardown of a board run, and the guard that makes it happen whatever the laptop does
// (design ruling D1: the board heals itself; the laptop is not trusted to finish).
//
// A run with a bare display stops LightDM, so a teardown that does not finish leaves the board
// without its login screen. The laptop cannot promise to finish one: a second Ctrl-C, a closed
// lid, a dropped USB link or a killed node all end the ssh that carries it, and a board script
// whose ssh is gone dies at its next line of output. So before LightDM is stopped the harness
// installs `guard.sh` in the run's directory and starts it detached on the board (its own session,
// immune to hang-ups). The guard does the teardown itself, when the laptop asks (a `stop` file) or
// when the laptop goes quiet (the heartbeat file it touches every 5 s is older than 20 s):
// Chromium, the static server and the Xorg of this run, each by checked pid, then LightDM if it
// was active, then `restore.txt` with what happened. It is the only thing that removes the run's
// directory (by renaming it to `<dir>.removing` first, so a teardown never sees it half removed),
// and only after a confirmed restore; otherwise the directory and its pid files stay, for a later
// teardown (`sh <dir>/guard.sh` runs it again) or a person.
//
// The laptop's side of a teardown is `teardownWaitScript`: create `stop`, wait (longer than the
// guard can take) for `restore.txt`, print it. Runs without a bare display keep the plain stop
// script in `remote.mjs`, built from the same fragments.
import {
  graphicalSessionFragment,
  lightdmRestoreFragment,
  LIGHTDM_RESTORE_S,
  xStopFragment,
} from './board-x.mjs';
import { serverStopFragment } from './board-server.mjs';
import { assertRemoteDir, DEFAULT_PARENTS } from './remote-dir.mjs';
import { spawnSsh } from './ssh.mjs';

/** The guard's timing (design ruling D1, values as decided). */
export const GUARD = Object.freeze({
  /** How often the laptop touches the heartbeat. */
  heartbeatS: 5,
  /** A heartbeat older than this means the laptop is gone. */
  staleS: 20,
  /** How often the guard looks. */
  tickS: 1,
  /**
   * How long it waits for a start script still on the board: above that script's own longest
   * waits (LightDM's stop, 5 s for its X server to let go, 20 s for Xorg to answer, the mode).
   * Its ssh timeout does not end it: a script read by `sh -s` dies only at its next write, and
   * this one writes nothing between `lightdm <state>` and its last lines.
   */
  startWaitS: 70,
  /** How long LightDM and its Xorg get to come back. */
  restoreS: LIGHTDM_RESTORE_S,
  /** How long it waits for the laptop to read `restore.txt` before it removes the directory. */
  ackS: 10,
});

/**
 * The longest the guard can take from the `stop` file to `restore.txt`: a look, the wait for a
 * start script, then each stop's own waits (the browser 10 s + 2 s, the server 5 s + 0.5 s, Xorg
 * 10 s + 1 s) and LightDM's, with a little slack for the commands themselves.
 */
export const GUARD_WORST_S = GUARD.tickS + GUARD.startWaitS + 12 + 5.5 + 11 + GUARD.restoreS + 5;
/** How long the laptop waits for `restore.txt`: longer than the guard can take (review I3). */
export const TEARDOWN_WAIT_S = 150;

/**
 * The part that stops the browser `launchScript` started: by its pid file, checked against that
 * pid's command line, then whatever of its process group is left. Prints `stopped`, `leftover N`
 * (and sets `$bleft` where N > 0) and `note ...` lines.
 */
export function browserStopFragment() {
  return `pid=''
bleft=''
if [ -r "$dir/chromium.pid" ]; then
  pid=$(cat "$dir/chromium.pid")
  case "$pid" in ''|*[!0-9]*) echo "note bad pid file"; pid='';; esac
else
  echo "note no pid file"
fi
if [ -n "$pid" ]; then
  if [ -r "/proc/$pid/cmdline" ] &&
     tr '\\0' ' ' <"/proc/$pid/cmdline" | grep -qF -- "--user-data-dir=$dir/profile"; then
    kill -TERM "$pid" 2>/dev/null
    n=0
    while kill -0 "$pid" 2>/dev/null && [ "$n" -lt 50 ]; do sleep 0.2; n=$((n+1)); done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null; echo "note had to kill"; sleep 0.5
    fi
    echo stopped
    # Whatever of its process group is left: its children, and only they.
    left=$(ps -eo pid=,pgid= | awk -v g="$pid" '$2==g {print $1}')
    if [ -n "$left" ]; then kill -TERM $left 2>/dev/null; sleep 1; fi
    left=$(ps -eo pid=,pgid= | awk -v g="$pid" '$2==g {print $1}')
    if [ -n "$left" ]; then kill -KILL $left 2>/dev/null; sleep 0.5; fi
    left=$(ps -eo pid=,pgid= | awk -v g="$pid" '$2==g {n++} END {print n+0}')
    echo "leftover $left"
    [ "$left" = 0 ] || bleft=1
  else
    echo "note pid $pid is not this run's browser: left alone"
  fi
fi
`;
}

/** The `case` line that refuses any directory but a run's: the last guard before an `rm -rf`. */
export function dirGuard(parents = DEFAULT_PARENTS) {
  const patterns = parents.map((parent) => `'${parent}'/neat-bench-*`).join('|');
  return `case "$dir" in ${patterns}) ;; *) echo "note refused $dir"; exit 2;; esac\n`;
}

const seconds = (value, name) => {
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`${name} ${value} is not whole seconds`);
  return value;
};

/**
 * `guard.sh` for the run in `dir`. `lockDir` and the timings are for the specs; a campaign takes
 * the defaults. Run as `sh <dir>/guard.sh`, it writes its pid first, waits for `stop` or a stale
 * heartbeat, waits for a start script that is still running (its `start.lock`), tears down into
 * `restore.txt` and prints it, then removes the directory if everything is stopped and the display
 * is back (after the laptop has read the result, when it asked), and exits.
 */
export function guardScript(dir, { parents = DEFAULT_PARENTS, lockDir = '/tmp', ...timing } = {}) {
  assertRemoteDir(dir, parents);
  const t = { ...GUARD, ...timing };
  for (const name of ['staleS', 'tickS', 'startWaitS', 'restoreS', 'ackS']) seconds(t[name], name);
  const teardown =
    browserStopFragment() +
    serverStopFragment() +
    xStopFragment({ lockDir }) +
    lightdmRestoreFragment({ lockDir, restoreS: t.restoreS });
  return `#!/bin/sh
# The board-side guard of one bench run (board-teardown.mjs in the neat-ui kit's bench harness).
# Rerun it as "sh ${dir}/guard.sh" to tear the run down again.
dir='${dir}'
${dirGuard(parents)}echo $$ >"$dir/guard.pid" || exit 1
rm -f "$dir/restore.txt" "$dir/restore.tmp" "$dir/ack"
why=''
while :; do
  if [ -e "$dir/stop" ]; then why=stop; break; fi
  beat=$(stat -c %Y "$dir/heartbeat" 2>/dev/null || echo 0)
  if [ $(( $(date +%s) - beat )) -gt ${t.staleS} ]; then
    why=heartbeat
    : >"$dir/stop"
    break
  fi
  sleep ${t.tickS}
done
echo "guard $$: teardown, asked by the $why, at $(date '+%F %T')"
# A start script still on the board would start something after this teardown stopped it.
n=0
while [ -r "$dir/start.lock" ] && kill -0 "$(cat "$dir/start.lock" 2>/dev/null)" 2>/dev/null &&
      [ "$n" -lt ${t.startWaitS * 5} ]; do
  sleep 0.2; n=$((n+1))
done
{
${teardown}} >"$dir/restore.tmp" 2>&1
# Kept for a later teardown or a person where anything of the run is still there or the display
# is not back: the pid files and LightDM's recorded state are what a second attempt needs.
keep="$bleft$sleft$xleft$dn"
if [ -n "$keep" ]; then
  echo "note kept $dir for another teardown: sh $dir/guard.sh" >>"$dir/restore.tmp"
fi
mv "$dir/restore.tmp" "$dir/restore.txt"
cat "$dir/restore.txt"
[ -z "$keep" ] || exit 1
if [ "$why" = stop ]; then
  n=0
  while [ ! -e "$dir/ack" ] && [ "$n" -lt ${t.ackS * 5} ]; do sleep 0.2; n=$((n+1)); done
fi
# Renamed first, so a laptop's teardown that lands now finds the directory whole (with its
# restore.txt) or gone, never half removed: a half removed one has no guard.sh any more, and
# would read as a run that had been started on nothing.
mv -- "$dir" "$dir.removing" && rm -rf -- "$dir.removing"
`;
}

/**
 * Whether `$gpid` is the guard of the run in the directory given as `$1`, by its command line
 * (`guard_in`), and of this run (`is_guard`, which needs `$dir`).
 */
function isGuardFragment() {
  return `guard_in() {
  case "$gpid" in ''|*[!0-9]*) return 1;; esac
  [ -r "/proc/$gpid/cmdline" ] && tr '\\0' ' ' <"/proc/$gpid/cmdline" | grep -qF -- "$1/guard.sh"
}
is_guard() { guard_in "$dir"; }
`;
}

/**
 * Refuses (`note ...`, exit 1) where another run's guard is alive in one of `parents`: two bare
 * runs would fight over LightDM (the second records it as stopped and never restores it, and
 * the first's restore starts it on a VT the second's X server is not on), so the second one's
 * frames would be meaningless and it would not be told. A directory whose guard is gone (a kept
 * one, for a person) does not count. Needs `$dir`.
 */
function otherGuardFragment(parents) {
  const guards = parents.map((parent) => `'${parent}'/neat-bench-*/guard.pid`).join(' ');
  return `${isGuardFragment()}for other in ${guards}; do
  [ -r "$other" ] || continue
  odir=\${other%/guard.pid}
  [ "$odir" = "$dir" ] && continue
  gpid=$(cat "$other" 2>/dev/null || true)
  if guard_in "$odir"; then
    echo "note another bench run is live on this board ($odir, guard $gpid): wait for it to end"
    exit 1
  fi
done
`;
}

/**
 * What a bare run's first script checks before it starts the guard, and so before anything else
 * is started or LightDM is touched: no other run's live guard, nobody logged in on the display.
 * A refusal leaves only the run's empty directory, which the laptop's teardown removes.
 */
export function bareStartChecksFragment(parents = DEFAULT_PARENTS) {
  return otherGuardFragment(parents) + graphicalSessionFragment();
}

/** Starts `$dir/guard.sh` detached (its own session, hang-ups ignored) and reads its pid. */
function guardStartFragment() {
  return `rm -f "$dir/guard.pid"
setsid nohup sh "$dir/guard.sh" </dev/null >>"$dir/guard.log" 2>&1 &
n=0
while [ ! -s "$dir/guard.pid" ] && [ "$n" -lt 25 ]; do sleep 0.2; n=$((n+1)); done
gpid=$(cat "$dir/guard.pid" 2>/dev/null || true)
`;
}

/**
 * The part of the run's first script (`prepareScript`'s `then`) that installs the guard, gives it
 * a fresh heartbeat and starts it, before anything else is started. Prints `guard N`, or a note
 * and exits 1 where it did not start.
 */
export function guardInstallFragment(dir, options = {}) {
  const script = guardScript(dir, options);
  if (/^NEAT_BENCH_GUARD$/m.test(script))
    throw new Error('the guard script holds its own delimiter');
  return `cat >"$dir/guard.sh" <<'NEAT_BENCH_GUARD'
${script}NEAT_BENCH_GUARD
: >"$dir/heartbeat"
${isGuardFragment()}${guardStartFragment()}is_guard || {
  echo "note the guard did not start: $(tail -n 3 "$dir/guard.log" 2>/dev/null)"
  exit 1
}
echo "guard $gpid"
`;
}

/** The guard's pid from the install's `guard N` line, or null. */
export function parseGuard(text) {
  const match = /^guard (\d+)$/m.exec(text);
  return match ? Number(match[1]) : null;
}

/**
 * The laptop's side of a guarded teardown: create `stop`, start the guard again where it is not
 * running, wait up to `waitS` for `restore.txt`, print it and acknowledge it, then wait for the
 * guard to remove the directory. Prints the guard's report and `removed`, or `gone` where the
 * directory was not there any more (the guard had already torn the run down: it removes the
 * directory only after a confirmed restore), or a note and exits 3 where the guard said nothing.
 */
export function teardownWaitScript(
  dir,
  { parents = DEFAULT_PARENTS, waitS = TEARDOWN_WAIT_S, ackS = GUARD.ackS } = {},
) {
  assertRemoteDir(dir, parents);
  seconds(waitS, 'waitS');
  seconds(ackS, 'ackS');
  return `dir='${dir}'
${dirGuard(parents)}if [ ! -d "$dir" ]; then echo gone; exit 0; fi
: >"$dir/stop" 2>/dev/null
gpid=$(cat "$dir/guard.pid" 2>/dev/null || true)
${isGuardFragment()}if ! is_guard && [ ! -e "$dir/restore.txt" ] && [ -d "$dir" ]; then
  if [ -r "$dir/guard.sh" ]; then
    echo "note the guard was not running: started it again"
${guardStartFragment()}  else
    # No guard script: the run never got past making its directory, so nothing was started.
    echo "note no guard in $dir: nothing had been started"
    rm -rf -- "$dir"
    [ -e "$dir" ] || echo removed
    exit 0
  fi
fi
n=0
while [ -d "$dir" ] && [ ! -e "$dir/restore.txt" ] && [ "$n" -lt ${waitS * 5} ]; do
  sleep 0.2; n=$((n+1))
done
if [ ! -d "$dir" ]; then echo gone; exit 0; fi
if [ ! -e "$dir/restore.txt" ]; then
  echo "note the guard (pid \${gpid:-unknown}) gave no result in ${waitS} s"
  exit 3
fi
cat "$dir/restore.txt"
if grep -q '^note kept ' "$dir/restore.txt"; then exit 0; fi
: >"$dir/ack" 2>/dev/null
n=0
while [ -e "$dir" ] && [ "$n" -lt ${(ackS + 5) * 5} ]; do sleep 0.2; n=$((n+1)); done
[ -e "$dir" ] || echo removed
`;
}

/** How long the laptop's ssh for `teardownWaitScript` may take: its waits, plus connecting. */
export const TEARDOWN_SSH_MS = (TEARDOWN_WAIT_S + GUARD.ackS + 5 + 30) * 1000;

/** The board side of the heartbeat: one touch per line the laptop sends, until it stops sending. */
export function heartbeatCommand(dir, parents) {
  assertRemoteDir(dir, parents);
  return `while read -r beat; do [ -d '${dir}' ] && touch '${dir}/heartbeat'; done`;
}

/**
 * Touches the guard's heartbeat every `everyMs` over a dedicated ssh: a line on its stdin is a
 * touch. When node goes, however it goes, the pipe closes, the board's loop ends and the heartbeat
 * stops, which is what tells the guard. A link that drops while node runs is opened again, and
 * said, since without it the guard tears the run down after 20 s. `stop()` ends it.
 */
export function startHeartbeat({
  ssh,
  dir,
  log = () => undefined,
  everyMs = GUARD.heartbeatS * 1000,
  retryMs = 5000,
  spawn,
}) {
  const command = heartbeatCommand(dir);
  let child = null;
  let stopped = false;
  let retry = null;
  const beat = () => {
    if (child?.stdin?.writable) child.stdin.write('\n');
  };
  const connect = () => {
    const link = spawnSsh(ssh, { command, stdio: ['pipe', 'ignore', 'pipe'], spawn });
    child = link;
    let error = '';
    link.stderr?.on('data', (chunk) => (error += chunk));
    link.stdin?.on('error', () => undefined);
    link.on('error', (failure) => (error ||= failure.message));
    link.on('close', (code) => {
      if (stopped || child !== link) return;
      log(
        `board: the heartbeat link ended (${error.trim() || `exit ${code}`}); opening it again ` +
          `(without it the board's guard tears the run down after ${GUARD.staleS} s)`,
      );
      retry = setTimeout(connect, retryMs);
    });
    beat();
  };
  connect();
  const timer = setInterval(beat, everyMs);
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
      clearTimeout(retry);
      child?.stdin?.end();
    },
  };
}
