// What the harness reads from the board over ssh (design 4.1, `--ssh`): the machine once, and the
// load, temperatures and CPU frequencies before and after each run, so a run on a throttled or
// busy board says so. Read-only scripts, run with `sh -s`; each read is guarded, since a board
// may have no cpufreq files (the Modalix devkit has none) or a thermal zone that cannot be read.
// A probe that finds nothing is an empty probe, not an error. The parsing is pure.

export const PROBE_SCRIPT = `
echo '--loadavg'; cat /proc/loadavg
echo '--thermal'; for z in /sys/class/thermal/thermal_zone*; do [ -r "$z/temp" ] && echo "$(cat "$z/type" 2>/dev/null) $(cat "$z/temp" 2>/dev/null)"; done
echo '--freq'; for f in /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq; do [ -r "$f" ] && cat "$f"; done
echo '--governor'; cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null
echo '--end'
`;

export const HOST_SCRIPT = `
echo '--uname'; uname -a
echo '--cpu'; grep -m1 -i 'model name' /proc/cpuinfo; lscpu 2>/dev/null | grep -i -m1 'model name'
echo '--board'; tr -d '\\0' < /proc/device-tree/model 2>/dev/null; echo
echo '--nproc'; nproc
echo '--mem'; free -m | awk '/^Mem:/ {print $2}'
echo '--display'; DISPLAY=\${DISPLAY:-:0} xrandr --current 2>/dev/null | head -4
echo '--end'
`;

/** The text between `--name` lines, by name. */
function sections(text) {
  const out = {};
  let name = null;
  for (const line of text.split('\n')) {
    const mark = /^--(\w+)$/.exec(line);
    if (mark) {
      name = mark[1];
      out[name] = [];
    } else if (name) {
      out[name].push(line);
    }
  }
  return out;
}

const filled = (lines = []) => lines.map((line) => line.trim()).filter(Boolean);

export function parseProbe(text) {
  const s = sections(text);
  const probe = { loadavg: [], temps: [], freqMhz: [] };
  const load = filled(s.loadavg)[0]?.split(/\s+/).slice(0, 3).map(Number);
  if (load?.length === 3 && load.every(Number.isFinite)) probe.loadavg = load;
  for (const line of filled(s.thermal)) {
    const match = /^(.*\S)\s+(-?\d+)$/.exec(line);
    if (match) probe.temps.push({ zone: match[1], c: Number(match[2]) / 1000 });
  }
  for (const line of filled(s.freq)) {
    if (/^\d+$/.test(line)) probe.freqMhz.push(Number(line) / 1000);
  }
  const governor = filled(s.governor)[0];
  if (governor) probe.governor = governor;
  return probe;
}

export function parseHost(text) {
  const s = sections(text);
  const model = (filled(s.cpu)[0] ?? '').replace(/^model name\s*:\s*/i, '');
  const board = filled(s.board)[0];
  return {
    uname: filled(s.uname)[0] ?? '',
    cpuModel: board && model ? `${model} (${board})` : model || board || '',
    memMb: Number(filled(s.mem)[0]) || 0,
    display: filled(s.display).join('\n'),
    cores: Number(filled(s.nproc)[0]) || 0,
  };
}

/** The run's thermal numbers from the probes either side; what the board cannot read is absent. */
export function summarizeProbes(before, after) {
  const summary = {};
  const freqs = [...before.freqMhz, ...after.freqMhz];
  if (freqs.length > 0) {
    summary.cpuMhzMin = Math.min(...freqs);
    summary.cpuMhzMaxBefore = Math.max(...before.freqMhz);
    summary.cpuMhzMaxAfter = Math.max(...after.freqMhz);
  }
  const temps = [...before.temps, ...after.temps].map((t) => t.c);
  if (temps.length > 0) summary.tempMaxC = Math.max(...temps);
  if (before.loadavg.length) summary.loadBefore = before.loadavg[0];
  if (after.loadavg.length) summary.loadAfter = after.loadavg[0];
  return summary;
}

/** Design 4.1: a frequency below the run's start by more than 10 % marks a throttled run. */
const THROTTLE = 0.1;

export function throttleWarning(before, after, label) {
  if (before.freqMhz.length === 0 || after.freqMhz.length === 0) return null;
  const start = Math.max(...before.freqMhz);
  const end = Math.max(...after.freqMhz);
  if (end >= start * (1 - THROTTLE)) return null;
  return (
    `${label}: the CPU's highest frequency fell from ${start} MHz to ${end} MHz over the run ` +
    '(more than 10 %): thermal throttling, so this run is not comparable with a cool one.'
  );
}
