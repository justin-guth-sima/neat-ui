import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HOST_SCRIPT,
  parseHost,
  parseProbe,
  PROBE_SCRIPT,
  summarizeProbes,
  throttleWarning,
} from './probes.mjs';

// What the devkit prints (2026-10-31): one thermal zone, no cpufreq files.
const BOARD = `--loadavg
0.26 0.27 0.27 1/312 1037226
--thermal
board 55125
--freq
--governor
--end
`;

const LAPTOP = `--loadavg
3.50 2.10 1.00 4/900 123
--thermal
acpitz 47000
x86_pkg_temp 61500
--freq
2400000
3600000
1200000
--governor
schedutil
--end
`;

test('reads the load average, temperatures in degrees and frequencies in MHz', () => {
  const probe = parseProbe(LAPTOP);
  assert.deepEqual(probe.loadavg, [3.5, 2.1, 1]);
  assert.deepEqual(probe.temps, [
    { zone: 'acpitz', c: 47 },
    { zone: 'x86_pkg_temp', c: 61.5 },
  ]);
  assert.deepEqual(probe.freqMhz, [2400, 3600, 1200]);
  assert.equal(probe.governor, 'schedutil');
});

test('reads a board with no cpufreq: load and temperature, nothing for frequency', () => {
  const probe = parseProbe(BOARD);
  assert.deepEqual(probe.loadavg, [0.26, 0.27, 0.27]);
  assert.deepEqual(probe.temps, [{ zone: 'board', c: 55.125 }]);
  assert.deepEqual(probe.freqMhz, []);
  assert.equal(probe.governor, undefined);
});

test('takes a probe that printed nothing as nothing, never as a failure', () => {
  assert.deepEqual(parseProbe(''), { loadavg: [], temps: [], freqMhz: [] });
});

test('only reads: the scripts name no command that changes the board', () => {
  for (const script of [PROBE_SCRIPT, HOST_SCRIPT]) {
    assert.doesNotMatch(script, /\b(rm|mv|kill|tee|chmod|chown|mkdir|apt|systemctl|reboot|dd)\b/);
  }
});

test('summarizes a run: lowest frequency, hottest zone and the load either side', () => {
  const before = parseProbe(LAPTOP);
  const after = parseProbe(LAPTOP.replace('61500', '70250').replace('3.50 2.10', '9.00 4.00'));
  assert.deepEqual(summarizeProbes(before, after), {
    cpuMhzMin: 1200,
    cpuMhzMaxBefore: 3600,
    cpuMhzMaxAfter: 3600,
    tempMaxC: 70.25,
    loadBefore: 3.5,
    loadAfter: 9,
  });
});

test('summarizes a board without cpufreq by what it has', () => {
  const s = summarizeProbes(parseProbe(BOARD), parseProbe(BOARD));
  assert.equal(s.cpuMhzMin, undefined);
  assert.equal(s.tempMaxC, 55.125);
});

test('flags throttling where the highest frequency fell more than 10 % over the run', () => {
  const before = parseProbe(LAPTOP);
  const slow = parseProbe(LAPTOP.replace('3600000', '3000000'));
  const warning = throttleWarning(before, slow, 'kit A r0');
  assert.match(warning, /kit A r0/);
  assert.match(warning, /3600.*3000/);
  // Exactly 10 % is not past it.
  assert.equal(
    throttleWarning(before, parseProbe(LAPTOP.replace('3600000', '3240000')), 'x'),
    null,
  );
  assert.equal(throttleWarning(before, before, 'x'), null);
});

test('flags nothing where there is no frequency to compare', () => {
  assert.equal(throttleWarning(parseProbe(BOARD), parseProbe(BOARD), 'x'), null);
});

test('reads the board’s identity for the result’s host entry', () => {
  const text = `--uname
Linux modalix 6.18.3-modalix #4837 SMP PREEMPT aarch64 GNU/Linux
--cpu
Model name:                              Cortex-A65
--board
SiMa.ai Modalix SoM 16Gig Board
--nproc
16
--mem
5898
--display
--end
`;
  assert.deepEqual(parseHost(text), {
    uname: 'Linux modalix 6.18.3-modalix #4837 SMP PREEMPT aarch64 GNU/Linux',
    cpuModel: 'Cortex-A65 (SiMa.ai Modalix SoM 16Gig Board)',
    memMb: 5898,
    display: '',
    cores: 16,
  });
});

test('reads a laptop’s /proc/cpuinfo model and a display mode', () => {
  const text = `--uname
Linux laptop 7.0 x86_64
--cpu
model name	: AMD Ryzen 7
--board
--nproc
8
--mem
31000
--display
Screen 0: minimum 16 x 16, current 1920 x 1080, maximum 32767 x 32767
HDMI-1 connected primary 1920x1080+0+0
--end
`;
  const host = parseHost(text);
  assert.equal(host.cpuModel, 'AMD Ryzen 7');
  assert.match(host.display, /current 1920 x 1080/);
});
