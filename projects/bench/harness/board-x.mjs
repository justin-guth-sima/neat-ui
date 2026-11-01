// A bare X server on the board for headed runs (design, "Display for headed board runs": option
// C, reversible). The board's desktop is LightDM; a run that wants Chromium alone on the HDMI
// output stops it, starts Xorg with a cookie of its own and puts LightDM back afterwards. What the
// harness changes is therefore three things: LightDM's running state (stop and start, never
// `disable`, so a reboot alone also brings the login screen back), one Xorg it started, and files
// under the run's own `/tmp/neat-bench-<run>/`. Nothing under `/etc`. What Xorg and Chromium write
// by themselves is theirs, and neither made nor removed here: Xorg's `/tmp/.X<d>-lock` and
// `/tmp/.X11-unix/X<d>` (left behind only where it needed the KILL; the next Xorg clears a stale
// lock), Chromium's `~/.pki/nssdb` and font caches whatever `--user-data-dir` says, and `sudo`'s
// line in the journal.
//
// Xorg runs as root through sudo, so its pid file is written by the script itself, as root, from
// the shell that then becomes Xorg (`exec` keeps the pid): the pid in the file is Xorg's, not
// sudo's, and where the file cannot be written Xorg is not started at all. The stop kills a pid
// only where its command line still names this run's cookie file (a recycled pid is never
// killed), and then asks LightDM back only if it was active before. These are script builders;
// the start runs with `sh -s` over ssh, the stop inside the board's guard (`board-teardown.mjs`).
// Their parts are validated first, because they are shell.
import { assertRemoteDir, startLockFragment } from './remote-dir.mjs';

/** How long the restore waits for LightDM and its own Xorg to be up (design ruling D4). */
export const LIGHTDM_RESTORE_S = 15;
/** The mode a bare display is set to unless `--remote-mode` says otherwise: the spec's 1080p. */
export const DEFAULT_MODE = Object.freeze({ w: 1920, h: 1080 });

const LOCK_DIR = /^\/[\w./-]*$/;

function assertLockDir(lockDir) {
  if (!LOCK_DIR.test(lockDir)) throw new Error(`lock directory "${lockDir}" is not a plain path`);
}

/**
 * Refuses (`note ...`, exit 1) where somebody is logged in to a graphical session on seat0.
 * Stopping LightDM takes that session's X server down with it, and its clients and unsaved work
 * with them: the one effect of a bare run that cannot be undone, and one on processes the harness
 * did not start. LightDM's own greeter (class `greeter`) and sessions on a tty or over ssh (class
 * `user`, no seat) are not in the way. Without a working `loginctl` (missing, or logind down)
 * there is no telling, so it refuses too. Run before LightDM is touched, and again at the stop
 * itself, as copying the site to the board takes a while in which somebody could log in.
 */
export function graphicalSessionFragment() {
  return `command -v loginctl >/dev/null 2>&1 ||
  { echo "note loginctl is missing: no way to tell whether somebody is logged in on the display"; exit 1; }
sessions=$(loginctl list-sessions --no-legend 2>/dev/null) ||
  { echo "note loginctl list-sessions failed: no way to tell whether somebody is logged in on the display"; exit 1; }
for session in $(printf '%s\\n' "$sessions" | awk '{print $1}'); do
  who=$(loginctl show-session "$session" -p Name -p Class -p Type -p Seat 2>/dev/null | awk -F= '
    $1 == "Name" { name = $2 }
    $1 == "Class" { class = $2 }
    $1 == "Type" { type = $2 }
    $1 == "Seat" { seat = $2 }
    END { if (class == "user" && seat == "seat0" && (type == "x11" || type == "wayland")) print name " (" type ")" }')
  [ -z "$who" ] || {
    echo "note session $session of $who is logged in on seat0: log it out first, or a bare run would end it"
    exit 1
  }
done
`;
}

/**
 * Starts the bare X server in the run's directory (which must exist and be watched by the guard).
 * It checks it can (`fuser`, passwordless sudo, nobody logged in) before LightDM is touched,
 * records whether LightDM was active, stops it, makes the cookie, starts Xorg on a free display
 * and VT, waits for it to answer, turns the screen saver and DPMS off on it and sets `mode` at
 * 60 Hz on its connected output. Prints `lightdm <state>`, `display :N`, `vt K`, `output NAME`,
 * `mode WxH`, `rate R` and `xpid N`. Where it fails (a mode the output does not offer, say) it
 * prints `note ...` lines and exits non-zero, before anything is measured; the teardown copes with
 * whatever it got to.
 * `lockDir` is where X keeps its lock files (`/tmp`; the specs point it elsewhere).
 */
export function xStartScript(dir, { parents, mode = DEFAULT_MODE, lockDir = '/tmp' } = {}) {
  assertRemoteDir(dir, parents);
  assertLockDir(lockDir);
  if (!Number.isInteger(mode?.w) || !Number.isInteger(mode?.h)) {
    throw new Error(`mode ${JSON.stringify(mode)} is not { w, h } in whole pixels`);
  }
  return `set -e
dir='${dir}'
locks='${lockDir}'
want='${mode.w}x${mode.h}'
[ -d "$dir" ] || { echo "note run directory missing"; exit 1; }
${startLockFragment()}
# Checked before LightDM is touched, so a board that cannot run the start keeps its desktop.
# Without fuser every VT would look free.
command -v fuser >/dev/null 2>&1 ||
  { echo "note fuser is missing (psmisc): no way to tell a free VT"; exit 1; }
sudo -n true 2>/dev/null ||
  { echo "note sudo asks for a password: the bare display needs it"; exit 1; }
${graphicalSessionFragment()}# Written before LightDM is touched: the teardown starts it again only if it was active.
state=$(systemctl is-active lightdm 2>/dev/null || true)
echo "$state" >"$dir/lightdm.state"
echo "lightdm \${state:-unknown}"
if [ "$state" = active ]; then
  not_stopping
  sudo -n systemctl stop lightdm
  # LightDM's own server takes a moment to let go of :0 and its VT.
  n=0
  while [ -e "$locks/.X0-lock" ] && [ "$n" -lt 25 ]; do sleep 0.2; n=$((n+1)); done
fi
d=0
while [ "$d" -lt 10 ]; do
  if [ ! -e "$locks/.X$d-lock" ] && [ ! -e "$locks/.X11-unix/X$d" ]; then break; fi
  d=$((d+1))
done
[ "$d" -lt 10 ] || { echo "note no free X display from :0 to :9"; exit 1; }
vt=''
for k in 7 8 9; do
  if ! sudo -n fuser -s "/dev/tty$k" 2>/dev/null; then vt=$k; break; fi
done
[ -n "$vt" ] || { echo "note no free VT among 7, 8 and 9"; exit 1; }
echo "$d" >"$dir/display"
auth="$dir/Xauthority"
# The cookie is private; the pid file below is written by root and must stay readable here.
(umask 077; xauth -f "$auth" add ":$d" . "$(mcookie)")
xorg=$(command -v Xorg)
not_stopping
# No pid file, no Xorg: one nobody recorded could not be stopped by its pid.
setsid sudo -n sh -c 'umask 022; echo $$ >"$1" || exit 1; shift; exec "$@"' sh "$dir/xorg.pid" \\
  "$xorg" ":$d" "vt$vt" -nolisten tcp -auth "$auth" -noreset -logfile "$dir/Xorg.log" \\
  >"$dir/xorg.out" 2>&1 </dev/null &
n=0
while [ ! -s "$dir/xorg.pid" ] && [ "$n" -lt 25 ]; do sleep 0.2; n=$((n+1)); done
export DISPLAY=":$d" XAUTHORITY="$auth"
n=0
until xset q >/dev/null 2>&1; do
  n=$((n+1))
  if [ "$n" -ge 100 ]; then
    echo "note Xorg did not answer in 20 s"
    tail -n 5 "$dir/xorg.out" "$dir/Xorg.log" 2>/dev/null | sed 's/^/note xorg: /'
    exit 1
  fi
  sleep 0.2
done
xset s off -dpms s noblank
# The mode on the connected output, at 60 Hz: the output's own preferred mode may be another
# (the board's HDMI prefers 1024x768). xrandr would take the nearest rate it has, so the rate is
# checked here first: a mode the output does not offer at 60 Hz is an error, not a quiet stand-in.
query=$(xrandr --query)
output=$(printf '%s\\n' "$query" | awk '$2 == "connected" {print $1; exit}')
[ -n "$output" ] || { echo "note no connected output on :$d"; exit 1; }
modes_of() {
  awk -v o="$output" '$1 == o {on = 1; next} /^[^ ]/ {on = 0} on {print}'
}
at60=$(printf '%s\\n' "$query" | modes_of | awk -v m="$want" '$1 == m {
  for (i = 2; i <= NF; i++) {
    r = $i; gsub(/[*+]/, "", r)
    if (r != "" && r + 0 >= 59.5 && r + 0 <= 60.5) { print r; exit }
  }
}')
if [ -z "$at60" ]; then
  offered=$(printf '%s\\n' "$query" | modes_of | awk '{print $1}' | tr '\\n' ' ')
  echo "note $output does not offer $want at 60 Hz; it offers $offered"
  exit 1
fi
xrandr --output "$output" --mode "$want" --rate 60
now=$(xrandr --query | modes_of | awk '/[*]/ {
  for (i = 2; i <= NF; i++) if ($i ~ /[*]/) { r = $i; gsub(/[*+]/, "", r) }
  print $1, r; exit
}')
set -- $now
[ "$1" = "$want" ] || { echo "note $output is at \${1:-no mode} after asking for $want"; exit 1; }
echo "display :$d"
echo "vt $vt"
echo "output $output"
echo "mode $1"
echo "rate $2"
echo "xpid $(cat "$dir/xorg.pid")"
`;
}

/**
 * What `xStartScript` printed: `{ lightdm, display, vt, output, mode: { w, h } | null, rateHz,
 * xpid }`, each null where it is missing or not what it should be.
 */
export function parseXStart(text) {
  const lines = text.split('\n').map((line) => line.trim());
  const field = (name) => lines.find((line) => line.startsWith(`${name} `))?.slice(name.length + 1);
  const mode = /^(\d{3,5})x(\d{3,5})$/.exec(field('mode') ?? '');
  const display = field('display');
  const output = field('output');
  const rate = field('rate');
  const xpid = field('xpid');
  return {
    lightdm: field('lightdm') ?? 'unknown',
    display: display && /^:\d{1,3}$/.test(display) ? display : null,
    vt: Number(field('vt')) || null,
    output: output && /^[\w.-]+$/.test(output) ? output : null,
    mode: mode ? { w: Number(mode[1]), h: Number(mode[2]) } : null,
    rateHz: rate && /^\d{1,3}(\.\d{1,3})?$/.test(rate) ? Number(rate) : null,
    xpid: xpid && /^\d+$/.test(xpid) ? Number(xpid) : null,
  };
}

/**
 * The part of the teardown that stops the Xorg this run started: by its pid file, else by the X
 * lock files (one per display, not the process table), and only a pid whose command line names
 * this run's cookie file. Every `sudo -n kill` sits behind that check in the same command. Prints
 * `xorg stopped`, `xorg left` (and sets `$xleft`) or a `note`, and reads what LightDM was into
 * `$was` for `lightdmRestoreFragment`.
 */
export function xStopFragment({ lockDir = '/tmp' } = {}) {
  assertLockDir(lockDir);
  return `xpid=''
xleft=''
is_our_xorg() {
  [ -n "$xpid" ] && [ -r "/proc/$xpid/cmdline" ] &&
    tr '\\0' ' ' <"/proc/$xpid/cmdline" | grep -qF -- "-auth $dir/Xauthority"
}
if [ -r "$dir/xorg.pid" ]; then
  xpid=$(cat "$dir/xorg.pid")
  case "$xpid" in ''|*[!0-9]*) xpid='';; esac
fi
if [ -n "$xpid" ] && ! is_our_xorg; then
  echo "note pid $xpid is not this run's Xorg: left alone"
  xpid=''
fi
# No pid file (never written, unreadable, or its pid gone): the lock files name every display's
# server, and the command line still decides whether one is this run's.
if [ -z "$xpid" ]; then
  for lock in '${lockDir}'/.X[0-9]-lock; do
    [ -r "$lock" ] || continue
    xpid=$(tr -d ' \\n' <"$lock" 2>/dev/null)
    case "$xpid" in ''|*[!0-9]*) xpid='';; esac
    if is_our_xorg; then break; fi
    xpid=''
  done
fi
if [ -n "$xpid" ]; then
  is_our_xorg && sudo -n kill -TERM "$xpid" 2>/dev/null
  n=0
  while is_our_xorg && [ "$n" -lt 50 ]; do sleep 0.2; n=$((n+1)); done
  if is_our_xorg; then
    is_our_xorg && sudo -n kill -KILL "$xpid" 2>/dev/null
    echo "note had to kill Xorg"; sleep 1
  fi
  if is_our_xorg; then echo "xorg left"; xleft=1; else echo "xorg stopped"; fi
fi
was=''
if [ -r "$dir/lightdm.state" ]; then was=$(cat "$dir/lightdm.state"); fi
case "$was" in active|inactive|failed|activating|unknown|'') ;; *) was='';; esac
`;
}

/**
 * The part that puts LightDM back if it was active before the run: started without waiting on
 * systemd (the wait is bounded here instead), then judged restored only once `is-active` says
 * `active` and LightDM's own Xorg holds a display (a lock file whose pid's command line has
 * LightDM's cookie under `/run/lightdm/`), for up to `restoreS` seconds: a LightDM that cannot get
 * the display is "active" for a moment before it fails. Prints `display restored`, `display not
 * restored: ...` (and sets `$dn`) or `display unchanged: ...`; where the run never got as far as
 * recording LightDM it says nothing, for it never touched it.
 */
export function lightdmRestoreFragment({ lockDir = '/tmp', restoreS = LIGHTDM_RESTORE_S } = {}) {
  assertLockDir(lockDir);
  if (!Number.isInteger(restoreS) || restoreS < 1) throw new Error(`restoreS ${restoreS}`);
  return `dn=''
lightdm_xorg() {
  for lock in '${lockDir}'/.X[0-9]-lock; do
    [ -r "$lock" ] || continue
    lp=$(tr -d ' \\n' <"$lock" 2>/dev/null)
    case "$lp" in ''|*[!0-9]*) continue;; esac
    if [ -r "/proc/$lp/cmdline" ] &&
       tr '\\0' ' ' <"/proc/$lp/cmdline" | grep -qF -- '/run/lightdm/'; then
      echo "$lp"; return
    fi
  done
}
if [ "$was" = active ] && [ -n "$xleft" ]; then
  echo "display not restored: Xorg (pid $xpid) is still running, so LightDM cannot take the display"
  dn=1
elif [ "$was" = active ]; then
  sudo -n systemctl --no-block start lightdm 2>/dev/null
  now=''
  lx=''
  n=0
  while [ "$n" -lt ${restoreS * 5} ]; do
    now=$(systemctl is-active lightdm 2>/dev/null || true)
    lx=$(lightdm_xorg)
    if [ "$now" = active ] && [ -n "$lx" ]; then break; fi
    sleep 0.2; n=$((n+1))
  done
  if [ "$now" = active ] && [ -n "$lx" ]; then
    echo "display restored"
  else
    xs="\${lx:+running}\${lx:-not running}"
    echo "display not restored: after ${restoreS} s lightdm is \${now:-unknown} and its Xorg is $xs"
    dn=1
  fi
elif [ -n "$was" ]; then
  echo "display unchanged: lightdm was $was before the run"
fi
`;
}
