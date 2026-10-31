import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { lightdmRestoreFragment, parseXStart, xStartScript, xStopFragment } from './board-x.mjs';
import { parseStopReport, stopScript } from './remote.mjs';

const work = mkdtempSync(join(tmpdir(), 'bench-x-'));
const parents = [work];
const spare = [];
after(() => {
  for (const child of spare) child.kill('SIGKILL');
  rmSync(work, { recursive: true, force: true });
});

test('starts Xorg privately: no TCP, its own cookie, no reset, the screen kept awake', () => {
  const script = xStartScript('/tmp/neat-bench-x');
  assert.match(script, /-nolisten tcp/);
  assert.match(script, /-auth "\$auth"/);
  assert.match(script, /-noreset/);
  assert.match(script, /xauth -f "\$auth" add ":\$d" \. "\$\(mcookie\)"/);
  assert.match(script, /xset s off -dpms s noblank/);
  assert.match(script, /auth="\$dir\/Xauthority"/);
  assert.match(script, /xset q/, 'waits until the server answers');
  assert.match(script, /-logfile "\$dir\/Xorg\.log"/, 'its log is in the run’s directory too');
});

test('only stops LightDM, never disables it, and leaves /etc and the process table alone', () => {
  const scripts = [
    xStartScript('/tmp/neat-bench-x'),
    stopScript('/tmp/neat-bench-x', undefined, { x: true, server: true }),
  ];
  for (const script of scripts) {
    assert.doesNotMatch(script, /\b(disable|mask|enable|pkill|killall|reboot|apt)\b/);
    assert.doesNotMatch(script, /\/etc\b/);
  }
  assert.match(scripts[0], /sudo -n systemctl stop lightdm/);
});

test('records whether LightDM was active before it stops it', () => {
  const script = xStartScript('/tmp/neat-bench-x');
  const recorded = script.indexOf('lightdm.state');
  assert.ok(recorded > 0 && recorded < script.indexOf('systemctl stop lightdm'));
});

test('refuses a directory that is not a run’s', () => {
  assert.throws(() => xStartScript('/tmp'), /directory/);
  assert.throws(() => xStartScript('/home/sima/neat-bench-x'), /directory/);
});

test('reads what the start printed, and not a display or mode that is not one', () => {
  assert.deepEqual(parseXStart('lightdm active\ndisplay :0\nvt 7\nmode 1920x1080\nxpid 4242\n'), {
    lightdm: 'active',
    display: ':0',
    vt: 7,
    mode: { w: 1920, h: 1080 },
    xpid: 4242,
  });
  const odd = parseXStart('display ;id\nmode big\nxpid x\n');
  assert.equal(odd.display, null);
  assert.equal(odd.mode, null);
  assert.equal(odd.xpid, null);
  assert.equal(odd.lightdm, 'unknown');
});

test('kills Xorg only after checking the pid’s command line, in both fragments of its stop', () => {
  const fragment = xStopFragment();
  const check = fragment.indexOf('if is_our_xorg; then');
  for (const match of fragment.matchAll(/sudo -n kill/g)) {
    assert.ok(match.index > check, 'every kill comes after the check');
  }
  assert.match(fragment, /-auth \$dir\/Xauthority/);
  // LightDM is started again only on the recorded state, after the directory is gone.
  const stop = stopScript('/tmp/neat-bench-x', undefined, { x: true });
  assert.ok(stop.indexOf('rm -rf') < stop.indexOf(lightdmRestoreFragment().split('\n')[0]));
  assert.match(lightdmRestoreFragment(), /if \[ "\$was" = active \]/);
});

test('has no sudo, systemctl or Xorg in the stop of a run that did not ask for the bare display', () => {
  const stop = stopScript('/tmp/neat-bench-x');
  assert.doesNotMatch(stop, /\b(sudo|systemctl|Xorg|lightdm)\b/);
});

// The stop, run for real with stand-ins for sudo and systemctl, and a process that looks like the
// run's Xorg to the command-line check.
const stubs = join(work, 'stubs');
mkdirSync(stubs);
writeFileSync(
  join(stubs, 'sudo'),
  '#!/bin/sh\n[ "$1" = -n ] && shift\necho "sudo $*" >>"$STUB_LOG"\nexec "$@"\n',
);
writeFileSync(
  join(stubs, 'systemctl'),
  `#!/bin/sh
echo "systemctl $*" >>"$STUB_LOG"
case "$1 $2" in
  "is-active lightdm") cat "$STUB_STATE" ;;
  "start lightdm") [ -z "$STUB_START_FAILS" ] && echo active >"$STUB_STATE" ;;
esac
exit 0
`,
);
chmodSync(join(stubs, 'sudo'), 0o755);
chmodSync(join(stubs, 'systemctl'), 0o755);

let counter = 0;
function board({ was, xorg = 'ours', startFails = false, lightdmNow = 'inactive' }) {
  counter += 1;
  const dir = join(work, `neat-bench-x${counter}`);
  mkdirSync(dir);
  const log = join(work, `log${counter}`);
  const state = join(work, `state${counter}`);
  writeFileSync(log, '');
  writeFileSync(state, lightdmNow);
  if (was !== undefined) writeFileSync(join(dir, 'lightdm.state'), `${was}\n`);
  let child = null;
  if (xorg) {
    const named = xorg === 'ours' ? `${dir}/Xauthority` : '/elsewhere';
    child = spawn('sh', ['-c', 'sleep 300', 'fake-Xorg', ':9', '-auth', named], {
      stdio: 'ignore',
    });
    spare.push(child);
    writeFileSync(join(dir, 'xorg.pid'), `${child.pid}\n`);
  }
  const run = () =>
    spawnSync('sh', ['-s'], {
      input: stopScript(dir, parents, { x: true }),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${stubs}:${process.env.PATH}`,
        STUB_LOG: log,
        STUB_STATE: state,
        ...(startFails && { STUB_START_FAILS: '1' }),
      },
    });
  return { dir, child, run, calls: () => readFileSync(log, 'utf8') };
}
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test('stops its Xorg, removes the directory and starts LightDM again when it had been active', async () => {
  const b = board({ was: 'active' });
  const out = b.run();
  assert.equal(out.status, 0, out.stderr);
  const report = parseStopReport(out.stdout);
  assert.equal(report.xorg, 'stopped');
  assert.equal(report.removed, true);
  assert.deepEqual(report.display, { state: 'restored', why: undefined });
  // The stand-in is this process's child: let the event loop reap it before asking.
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(alive(b.child.pid), false);
  assert.equal(existsSync(b.dir), false);
  assert.match(b.calls(), /systemctl start lightdm/);
  assert.ok(b.calls().indexOf('sudo kill') < b.calls().indexOf('systemctl start lightdm'));
});

test('does not start LightDM when it was not active before the run', () => {
  const b = board({ was: 'inactive' });
  const report = parseStopReport(b.run().stdout);
  assert.equal(report.display.state, 'unchanged');
  assert.doesNotMatch(b.calls(), /systemctl start/);
  assert.equal(report.xorg, 'stopped');
});

test('says the display is not restored when LightDM does not come back', () => {
  const b = board({ was: 'active', startFails: true });
  const report = parseStopReport(b.run().stdout);
  assert.equal(report.display.state, 'not-restored');
  assert.match(report.display.why, /lightdm is inactive/);
});

test('leaves a pid alone that is not its Xorg, and still puts LightDM back', () => {
  const b = board({ was: 'active', xorg: 'another' });
  const report = parseStopReport(b.run().stdout);
  assert.equal(report.xorg, undefined);
  assert.match(report.notes.join(' '), /not this run's Xorg/);
  assert.ok(alive(b.child.pid));
  assert.equal(report.display.state, 'restored');
  assert.doesNotMatch(b.calls(), /sudo kill/);
});

test('a start that never got as far as recording LightDM starts nothing, and a second stop is harmless', () => {
  const b = board({ was: undefined, xorg: null });
  const out = b.run();
  const report = parseStopReport(out.stdout);
  assert.equal(report.removed, true);
  assert.equal(report.display, undefined);
  assert.doesNotMatch(b.calls(), /systemctl start/);
  const again = b.run();
  assert.equal(again.status, 0, again.stderr);
  assert.equal(parseStopReport(again.stdout).removed, true);
});

test('a second stop after a restore does nothing more: the record went with the directory', () => {
  const b = board({ was: 'active' });
  b.run();
  const first = b.calls();
  const again = parseStopReport(b.run().stdout);
  assert.equal(again.display, undefined);
  assert.equal(b.calls(), first);
});

test('finds its Xorg by the display’s lock file where the pid file cannot be read, still checking it', async () => {
  const b = board({ was: 'active' });
  const lockDir = join(work, `locks${counter}`);
  mkdirSync(lockDir);
  writeFileSync(join(b.dir, 'display'), '9\n');
  writeFileSync(join(lockDir, '.X9-lock'), `${String(b.child.pid).padStart(10)}\n`);
  rmSync(join(b.dir, 'xorg.pid'));
  const out = spawnSync('sh', ['-s'], {
    input: `dir='${b.dir}'\n${xStopFragment({ lockDir })}echo "was=$was"\n`,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${stubs}:${process.env.PATH}`, STUB_LOG: join(work, 'x') },
  });
  assert.match(out.stdout, /^xorg stopped$/m, out.stderr);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(alive(b.child.pid), false);
  rmSync(b.dir, { recursive: true });
});

test('does not start LightDM under an Xorg it could not stop, and says so', () => {
  const script = `dir='/tmp/neat-bench-x'\nwas=active\nxleft=1\nxpid=4242\n${lightdmRestoreFragment()}`;
  const out = spawnSync('sh', ['-s'], { input: script, encoding: 'utf8' });
  assert.match(out.stdout, /display not restored: Xorg \(pid 4242\) is still running/);
  assert.equal(parseStopReport(out.stdout).display.state, 'not-restored');
});

test('makes the cookie private but not the pid file Xorg’s shell writes as root', () => {
  const script = xStartScript('/tmp/neat-bench-x');
  assert.match(script, /\(umask 077; xauth -f/);
  assert.match(script, /sh -c 'umask 022; echo \$\$ >"\$1"/);
});
