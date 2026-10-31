// A bare X server on the board for headed runs (design, "Display for headed board runs": option
// C, reversible). The board's desktop is LightDM; a run that wants Chromium alone on the HDMI
// output stops it, starts Xorg with a cookie of its own and puts LightDM back afterwards. What the
// harness changes is therefore three things: LightDM's running state (stop and start, never
// `disable`, so a reboot alone also brings the login screen back), one Xorg it started, and files
// under the run's own `/tmp/neat-bench-<run>/`. Nothing under `/etc`.
//
// Xorg runs as root through sudo, so its pid file is written by the script itself, as root, from
// the shell that then becomes Xorg (`exec` keeps the pid): the pid in the file is Xorg's, not
// sudo's. The stop kills that pid only where its command line still names this run's cookie file
// (a recycled pid is never killed), and then asks LightDM back only if it was active before.
// These are script builders, run with `sh -s` over ssh like `remote.mjs`'s; their parts are
// validated first, because they are shell.
import { assertRemoteDir } from './remote-dir.mjs';

/**
 * Starts the bare X server in the run's directory (which must exist: the caller made it, and
 * registered the teardown first). It records whether LightDM was active, stops it, makes the
 * cookie, starts Xorg on a free display and VT, waits for it to answer, turns the screen
 * saver and DPMS off on it, and prints `lightdm <state>`, `display :N`, `vt K`, `mode WxH` and
 * `xpid N`. Where it fails it prints `note ...` lines and exits non-zero; the teardown copes with
 * whatever it got to.
 */
export function xStartScript(dir, parents) {
  assertRemoteDir(dir, parents);
  return `set -e
dir='${dir}'
[ -d "$dir" ] || { echo "note run directory missing"; exit 1; }
# Written before LightDM is touched: the teardown starts it again only if it was active.
state=$(systemctl is-active lightdm 2>/dev/null || true)
echo "$state" >"$dir/lightdm.state"
echo "lightdm \${state:-unknown}"
if [ "$state" = active ]; then
  sudo -n systemctl stop lightdm
  # LightDM's own server takes a moment to let go of :0 and its VT.
  n=0
  while [ -e /tmp/.X0-lock ] && [ "$n" -lt 25 ]; do sleep 0.2; n=$((n+1)); done
fi
d=0
while [ "$d" -lt 10 ]; do
  if [ ! -e "/tmp/.X$d-lock" ] && [ ! -e "/tmp/.X11-unix/X$d" ]; then break; fi
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
setsid sudo -n sh -c 'umask 022; echo $$ >"$1"; shift; exec "$@"' sh "$dir/xorg.pid" \\
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
mode=$(xrandr --current | sed -n 's/^Screen [0-9]*:.* current \\([0-9]*\\) x \\([0-9]*\\),.*/\\1x\\2/p' | head -n 1)
echo "display :$d"
echo "vt $vt"
echo "mode $mode"
echo "xpid $(cat "$dir/xorg.pid")"
`;
}

/** What `xStartScript` printed: `{ lightdm, display, vt, mode: { w, h } | null, xpid }`. */
export function parseXStart(text) {
  const lines = text.split('\n').map((line) => line.trim());
  const field = (name) => lines.find((line) => line.startsWith(`${name} `))?.slice(name.length + 1);
  const mode = /^(\d{3,5})x(\d{3,5})$/.exec(field('mode') ?? '');
  const display = field('display');
  const xpid = field('xpid');
  return {
    lightdm: field('lightdm') ?? 'unknown',
    display: display && /^:\d{1,3}$/.test(display) ? display : null,
    vt: Number(field('vt')) || null,
    mode: mode ? { w: Number(mode[1]), h: Number(mode[2]) } : null,
    xpid: xpid && /^\d+$/.test(xpid) ? Number(xpid) : null,
  };
}

/**
 * The part of the stop script that stops the Xorg this run started: by its pid file, and only
 * where that pid's command line names this run's cookie file. Prints `xorg stopped`, `xorg left`
 * or a `note`, and reads what LightDM was into `$was` for `lightdmRestoreFragment`.
 */
export function xStopFragment({ lockDir = '/tmp' } = {}) {
  return `xpid=''
xleft=''
if [ -r "$dir/xorg.pid" ]; then
  xpid=$(cat "$dir/xorg.pid")
  case "$xpid" in ''|*[!0-9]*) xpid='';; esac
fi
# Without a usable pid file the display's lock file names the server, and the command line below
# still decides whether it is this run's.
if [ -z "$xpid" ] && [ -r "$dir/display" ]; then
  xd=$(cat "$dir/display")
  case "$xd" in ''|*[!0-9]*) ;; *)
    xpid=$(tr -d ' \\n' 2>/dev/null <'${lockDir}'"/.X$xd-lock")
    case "$xpid" in ''|*[!0-9]*) xpid='';; esac;;
  esac
fi
is_our_xorg() {
  [ -r "/proc/$xpid/cmdline" ] &&
    tr '\\0' ' ' <"/proc/$xpid/cmdline" | grep -qF -- "-auth $dir/Xauthority"
}
if [ -n "$xpid" ]; then
  if is_our_xorg; then
    sudo -n kill -TERM "$xpid" 2>/dev/null
    n=0
    while is_our_xorg && [ "$n" -lt 50 ]; do sleep 0.2; n=$((n+1)); done
    if is_our_xorg; then
      sudo -n kill -KILL "$xpid" 2>/dev/null; echo "note had to kill Xorg"; sleep 1
    fi
    if is_our_xorg; then echo "xorg left"; xleft=1; else echo "xorg stopped"; fi
  else
    echo "note pid $xpid is not this run's Xorg: left alone"
  fi
fi
was=''
if [ -r "$dir/lightdm.state" ]; then was=$(cat "$dir/lightdm.state"); fi
case "$was" in active|inactive|failed|activating|unknown|'') ;; *) was='';; esac
`;
}

/**
 * The part that runs after the directory is gone: if LightDM was active before the run, start
 * it and check. Prints \`display restored\`, \`display not restored: ...\` or
 * \`display unchanged: ...\`; where the run never got as far as recording LightDM it says nothing.
 */
export function lightdmRestoreFragment() {
  return `if [ "$was" = active ] && [ -n "$xleft" ]; then
  echo "display not restored: Xorg (pid $xpid) is still running, so LightDM cannot take the display"
elif [ "$was" = active ]; then
  sudo -n systemctl start lightdm 2>/dev/null
  n=0
  while [ "$(systemctl is-active lightdm 2>/dev/null)" != active ] && [ "$n" -lt 10 ]; do
    sleep 0.4; n=$((n+1))
  done
  # A LightDM that cannot get the display is "active" for a moment before it fails.
  sleep 2
  now=$(systemctl is-active lightdm 2>/dev/null || true)
  if [ "$now" = active ]; then
    echo "display restored"
  else
    echo "display not restored: lightdm is \${now:-unknown} (sudo systemctl start lightdm)"
  fi
elif [ -n "$was" ]; then
  echo "display unchanged: lightdm was $was before the run"
fi
`;
}
