// A stand-in board for the specs of the board scripts (`board-x`, `board-teardown`): small shell
// stand-ins for sudo, systemctl, fuser, xauth, mcookie, Xorg, xset and xrandr, put first on the
// PATH, so the real scripts run here, as this user, and change nothing but a temporary folder.
// Each call is logged to `$STUB_LOG`; the stand-ins' state lives in files named by `STUB_*`.
// Not a spec itself, and nothing outside the specs imports it.
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * For the specs that run a board script for real. The scripts are the board's (GNU userland and
 * `/proc`): `stat -c %Y`, `/proc/<pid>/cmdline`, `ps -eo pgid=` and a fractional `sleep` do not
 * exist on macOS, where the guard would read every heartbeat as stale.
 */
export const LINUX_ONLY = { skip: process.platform !== 'linux' && 'board scripts need GNU/Linux' };

const STUBS = {
  sudo: `[ "$1" = -n ] && shift
echo "sudo $*" >>"$STUB_LOG"
exec "$@"
`,
  // is-active reads the state file; stop makes it inactive; start (with or without --no-block)
  // makes it active, unless told to fail, and where told, puts LightDM's Xorg on :0 by its lock.
  systemctl: `args=$(echo "$*" | sed 's/--no-block //')
echo "systemctl $*" >>"$STUB_LOG"
case "$args" in
  "is-active lightdm") s=$(cat "$STUB_STATE"); echo "$s"; [ "$s" = active ] ;;
  "stop lightdm") echo inactive >"$STUB_STATE"; rm -f "$STUB_LOCKS/.X0-lock" ;;
  "start lightdm")
    [ -n "$STUB_START_FAILS" ] && exit 0
    echo active >"$STUB_STATE"
    [ -z "$STUB_LIGHTDM_XPID" ] ||
      printf '%10d\\n' "$STUB_LIGHTDM_XPID" >"$STUB_LOCKS/.X0-lock" ;;
esac
`,
  // The sessions are the lines of `$STUB_SESSIONS` (`id name class type seat`, `-` for no seat).
  // list-sessions prints systemd's columns (session, uid, user, seat, tty); show-session prints
  // each property in an order of its own, whichever were asked for, as systemd does.
  loginctl: `case "$1" in
  list-sessions) awk '{ print $1, 1000, $2, ($5 == "-" ? "" : $5), "-" }' "$STUB_SESSIONS" ;;
  show-session)
    awk -v id="$2" '$1 == id {
      print "Type=" $4; print "Class=" $3; print "Name=" $2; print "Seat=" ($5 == "-" ? "" : $5)
    }' "$STUB_SESSIONS" ;;
esac
`,
  fuser: `echo "fuser $*" >>"$STUB_LOG"
exit 1
`,
  xauth: `echo "xauth $*" >>"$STUB_LOG"
: >"$2"
`,
  mcookie: `echo 00112233445566778899aabbccddeeff
`,
  // Answers (xset) while it runs; a TERM ends it.
  Xorg: `echo "Xorg $*" >>"$STUB_LOG"
trap 'rm -f "$STUB_XUP"; exit 0' TERM
: >"$STUB_XUP"
while :; do sleep 0.2; done
`,
  xset: `[ -e "$STUB_XUP" ] || exit 1
echo "xset $*" >>"$STUB_LOG"
`,
  // The board's HDMI as seen on 2026-10-31: 1024x768 preferred, 1920x1080 offered, no 4K.
  xrandr: `if [ "$1" = --output ]; then
  echo "xrandr $*" >>"$STUB_LOG"
  echo "$4" >"$STUB_MODE"
  exit 0
fi
now=$(cat "$STUB_MODE" 2>/dev/null || echo 1024x768)
echo "Screen 0: minimum 320 x 200, current 1024 x 768, maximum 8192 x 8192"
echo "HDMI-1 connected $now+0+0 (normal left inverted right x axis y axis) 0mm x 0mm"
for line in "1024x768 60.00 +" "1920x1080 60.00 50.00 59.94" "1280x720 60.00 50.00" \\
            "800x600 60.32 56.25"; do
  set -- $line
  m=$1; shift
  rates=''
  for r in "$@"; do
    [ "$r" = + ] && { rates="$rates+"; continue; }
    if [ "$m" = "$now" ] && [ -z "$marked" ]; then rates="$rates    $r*"; marked=1
    else rates="$rates    $r"; fi
  done
  echo "   $m $rates"
done
echo "DVI-I-1 disconnected (normal left inverted right x axis y axis)"
`,
};

/** Writes the stand-ins into `dir` (made if missing), all but those named in `omit`. */
export function writeStubs(dir, { omit = [] } = {}) {
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(STUBS)) {
    if (omit.includes(name)) continue;
    writeFileSync(join(dir, name), `#!/bin/sh\n${body}`);
    chmodSync(join(dir, name), 0o755);
  }
  return dir;
}

/** The sessions of the board as of 2026-10-31: LightDM's greeter on seat0, a tty login, no seat. */
export const BOARD_SESSIONS = ['c1 lightdm greeter x11 seat0', '3 sima user tty -'];

/**
 * The environment a script runs in on the stand-in board: the stand-ins first on the PATH, and
 * their files in `root` (`log`, `state` holding LightDM's state, `locks` for X lock files,
 * `sessions` for logins, the board's own to begin with).
 */
export function stubEnv({ stubs, root, extra = {} }) {
  mkdirSync(join(root, 'locks'), { recursive: true });
  writeFileSync(join(root, 'sessions'), `${BOARD_SESSIONS.join('\n')}\n`);
  return {
    ...process.env,
    PATH: `${stubs}:${process.env.PATH}`,
    STUB_LOG: join(root, 'log'),
    STUB_STATE: join(root, 'state'),
    STUB_LOCKS: join(root, 'locks'),
    STUB_XUP: join(root, 'xorg-up'),
    STUB_MODE: join(root, 'mode'),
    STUB_SESSIONS: join(root, 'sessions'),
    ...extra,
  };
}
