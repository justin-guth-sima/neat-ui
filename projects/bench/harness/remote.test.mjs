import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  assertRemoteDir,
  browserFlags,
  launchScript,
  parseStopReport,
  remoteDirFor,
  stopScript,
} from './remote.mjs';

const OPTIONS = { port: 9333, chromium: 'chromium', headless: true, display: undefined };

// The scripts' real runs below happen in a folder of their own, which they are told is theirs.
const work = mkdtempSync(join(tmpdir(), 'bench-remote-'));
const parents = [work];

test('names a run’s directory under /tmp, unique to the run', () => {
  assert.equal(remoteDirFor('abc123-kit'), '/tmp/neat-bench-abc123-kit');
  assert.throws(() => remoteDirFor('a b'), /run id/);
  assert.throws(() => remoteDirFor('../x'), /run id/);
  assert.throws(() => remoteDirFor(''), /run id/);
});

test('accepts only a directory this harness made, where the stop script may delete', () => {
  assertRemoteDir('/tmp/neat-bench-ok1');
  for (const dir of [
    '/tmp',
    '/',
    '/home/sima',
    '/tmp/neat-bench-',
    '/tmp/other-ok1',
    '/tmp/neat-bench-a/b',
    '/tmp/neat-bench-a b',
    '/tmp/neat-bench-a;rm -rf /',
    '/tmp/neat-bench-$(id)',
    '/etc/neat-bench-x',
    'neat-bench-x',
  ]) {
    assert.throws(() => assertRemoteDir(dir), /directory/, dir);
  }
});

test('starts the browser on the board’s loopback with a profile of its own', () => {
  const flags = browserFlags('/tmp/neat-bench-x', OPTIONS);
  assert.ok(flags.includes('--remote-debugging-port=9333'));
  assert.ok(flags.includes('--remote-debugging-address=127.0.0.1'));
  assert.ok(flags.includes('--user-data-dir=/tmp/neat-bench-x/profile'));
  assert.ok(flags.includes('--headless=new'));
  assert.ok(flags.includes('--enable-precise-memory-info'));
  assert.ok(!flags.some((flag) => flag.startsWith('--kiosk')));
});

test('shows on the board’s display, kiosk, when given one, and is not headless then', () => {
  const flags = browserFlags('/tmp/neat-bench-x', { ...OPTIONS, headless: false, display: ':0' });
  assert.ok(flags.includes('--kiosk'));
  assert.ok(!flags.some((flag) => flag.startsWith('--headless')));
});

test('refuses a port, browser name or display that could carry a command', () => {
  const dir = '/tmp/neat-bench-x';
  assert.throws(() => launchScript(dir, { ...OPTIONS, port: '9333; id' }), /port/);
  assert.throws(() => launchScript(dir, { ...OPTIONS, chromium: 'chromium; id' }), /browser/);
  assert.throws(
    () => launchScript(dir, { ...OPTIONS, display: ':0; id', headless: false }),
    /display/,
  );
});

test('starts nothing but the one browser: no other command, and no pattern kill, in its scripts', () => {
  const launch = launchScript('/tmp/neat-bench-x', OPTIONS);
  const stop = stopScript('/tmp/neat-bench-x');
  for (const script of [launch, stop]) {
    assert.doesNotMatch(script, /\b(pkill|killall|apt|systemctl|reboot|sudo)\b/);
  }
  assert.doesNotMatch(launch, /\b(python3?|node)\b/);
});

// The scripts, run for real against a stand-in browser that keeps a child process, as Chromium's
// renderers are.
const fake = join(work, 'fake-chromium');
writeFileSync(fake, `#!/bin/sh\nexec sh -c 'sleep 300 & wait' fake "$@"\n`);
chmodSync(fake, 0o755);
const spare = [];
after(() => {
  for (const child of spare) child.kill('SIGKILL');
  rmSync(work, { recursive: true, force: true });
});

const sh = (script) => spawnSync('sh', ['-s'], { input: script, encoding: 'utf8' });
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const members = (pgid) =>
  spawnSync('sh', ['-c', `ps -eo pid=,pgid= | awk '$2==${pgid} {print $1}'`], { encoding: 'utf8' })
    .stdout.split('\n')
    .filter(Boolean)
    .map(Number);

test('launches a detached browser with a pid file, and stops it, its children and its files', async () => {
  const dir = join(work, 'neat-bench-test-a');
  assertRemoteDir(dir, parents);
  const launched = sh(launchScript(dir, { ...OPTIONS, chromium: fake, parents }));
  assert.equal(launched.status, 0, launched.stderr);
  const pid = Number(readPid(dir));
  assert.ok(alive(pid));
  await sleepMs(300);
  assert.ok(members(pid).length >= 2, 'the browser and a child share one process group');
  assert.ok(existsSync(join(dir, 'profile')));

  const stopped = sh(stopScript(dir, parents));
  assert.equal(stopped.status, 0, stopped.stderr);
  assert.deepEqual(parseStopReport(stopped.stdout), {
    stopped: true,
    removed: true,
    leftover: 0,
    notes: [],
  });
  assert.equal(alive(pid), false);
  assert.deepEqual(members(pid), []);
  assert.equal(existsSync(dir), false);
});

function readPid(dir) {
  return spawnSync('cat', [join(dir, 'chromium.pid')], { encoding: 'utf8' }).stdout.trim();
}

test('does not launch into a directory that exists: it is another run’s', () => {
  const dir = join(work, 'neat-bench-test-b');
  const first = sh(launchScript(dir, { ...OPTIONS, chromium: fake, parents }));
  assert.equal(first.status, 0, first.stderr);
  const second = sh(launchScript(dir, { ...OPTIONS, chromium: fake, parents }));
  assert.notEqual(second.status, 0);
  sh(stopScript(dir, parents));
});

test('leaves a process alone whose id is in the pid file but is not its browser, and still cleans up', async () => {
  const dir = join(work, 'neat-bench-test-c');
  const innocent = spawn('sleep', ['300'], { stdio: 'ignore' });
  spare.push(innocent);
  const made = sh(`mkdir -m 700 '${dir}' && echo ${innocent.pid} > '${dir}/chromium.pid'`);
  assert.equal(made.status, 0, made.stderr);

  const stopped = sh(stopScript(dir, parents));
  assert.equal(stopped.status, 0, stopped.stderr);
  const report = parseStopReport(stopped.stdout);
  assert.equal(report.stopped, false);
  assert.equal(report.removed, true);
  assert.match(report.notes.join(' '), /not this run's browser/);
  assert.ok(alive(innocent.pid), 'the unrelated process is still running');
  assert.equal(existsSync(dir), false);
});

test('cleans up after a browser that never started: no pid file, just the directory', () => {
  const dir = join(work, 'neat-bench-test-d');
  sh(`mkdir -m 700 '${dir}'`);
  const report = parseStopReport(sh(stopScript(dir, parents)).stdout);
  assert.deepEqual(report, { stopped: false, removed: true, leftover: 0, notes: ['no pid file'] });
});

test('refuses to delete a directory that is not one of its own', () => {
  assert.throws(() => stopScript('/tmp'), /directory/);
  assert.throws(() => stopScript('/home/sima'), /directory/);
});

test('reads a stop report, and says unclean where the files or processes remain', () => {
  assert.deepEqual(parseStopReport('stopped\nleftover 0\nremoved\n'), {
    stopped: true,
    removed: true,
    leftover: 0,
    notes: [],
  });
  const dirty = parseStopReport('stopped\nleftover 2\nnote something odd\n');
  assert.equal(dirty.removed, false);
  assert.equal(dirty.leftover, 2);
  assert.deepEqual(dirty.notes, ['something odd']);
});
