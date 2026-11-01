import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { parseArgs } from './args.mjs';
import { displayRestore, runCampaign } from './campaign.mjs';
import { runCleanups } from './cleanup.mjs';

const out = mkdtempSync(join(tmpdir(), 'bench-campaign-'));
after(() => rmSync(out, { recursive: true, force: true }));

const SHA = 'c'.repeat(40);

const options = (...args) =>
  parseArgs([
    '--machine',
    'rig',
    '--url',
    'http://127.0.0.1:1/',
    '--renderers',
    'kit',
    '--repeats',
    '3',
    '--cooldown',
    '0',
    '--no-screenshots',
    '--out',
    mkdtempSync(join(out, 'run-')),
    ...args,
  ]);

const step = (schedule) => ({
  renderer: schedule.renderer,
  ladder: schedule.ladder,
  step: 0,
  level: 1,
  refining: false,
  repeat: schedule.repeat,
  params: { blocks: 1, edges: 1, notes: 1, msgsPerSec: 0 },
  phases: { idle: { fps: 60 } },
});

/** What `runOnePage` resolves with for a run that went well, built from `gitSha`. */
const goodRun = (schedule, gitSha = SHA) => ({
  ok: true,
  schedule,
  notes: [],
  steps: [step(schedule)],
  result: {
    schema: 1,
    runId: `p-${schedule.repeat}`,
    bench: { gitSha, kitVersion: 'x', vflowVersion: 'x', build: 'production' },
    machine: { label: 'rig', refreshHz: 60 },
    config: { warmupMs: 1, phases: [] },
    steps: [],
    warnings: [],
    end: 'cap',
    measurement: { loaf: { source: 'none', lost: 0 } },
  },
});

function rig({ headless = false, viewport = 'native', runOnePage, session } = {}) {
  const opened = {
    mode: { headless, viewport, userAgent: 'x' },
    facts: async () => ({ version: 'Chrome/1', gpu: { featureStatus: {} }, launchArgs: [] }),
    session: session ?? (async () => ({ release: async () => undefined })),
    close: async () => undefined,
  };
  const seen = { opens: [], remotes: [], served: 0, stopWith: null, hosts: [] };
  const deps = {
    openBrowser: async (args) => {
      seen.opens.push(args);
      return opened;
    },
    startRemote: async (args) => {
      seen.remotes.push(args);
      args.cleanups.push(async () => {
        seen.remotes.push('stopped');
        if (seen.stopWith) args.onStopped(seen.stopWith);
      });
      return {
        endpoint: args.browser === false ? undefined : 'http://127.0.0.1:55555',
        pageBase: args.serve ? 'http://10.42.0.68:40213/' : 'http://127.0.0.1:4390/',
        display:
          args.remote.display === 'bare'
            ? { kind: 'bare', name: ':0', vt: 7, mode: { w: 1920, h: 1080 }, lightdm: 'active' }
            : null,
        stop: async () => undefined,
      };
    },
    serveDist: async () => {
      seen.served += 1;
      return { url: 'http://127.0.0.1:2/', port: 2, close: async () => undefined };
    },
    runOnePage: runOnePage ?? (async ({ schedule }) => goodRun(schedule)),
    sshRun: async (host, script) => {
      seen.hosts.push(script);
      return { code: 0, stdout: '', stderr: '' };
    },
    sessionMs: 60,
  };
  return { deps, seen, cleanups: [], logs: [] };
}

const go = (r, opts) =>
  runCampaign(opts, { log: (line) => r.logs.push(line), cleanups: r.cleanups, deps: r.deps });
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));

test('writes the result after every run, so a campaign that dies has the runs it finished', async () => {
  const opts = options();
  let seenBetween = null;
  const r = rig({
    runOnePage: async ({ schedule }) => {
      if (schedule.repeat === 1) {
        const [name] = readdirSync(opts.out).filter((f) => f.endsWith('.json'));
        seenBetween = read(join(opts.out, name));
      }
      return goodRun(schedule);
    },
  });
  const done = await go(r, opts);
  assert.equal(seenBetween.runs.length, 1, 'the first run was already in the file');
  assert.equal(seenBetween.harness.complete, false);
  assert.match(seenBetween.warnings.join('\n'), /did not finish.*1 of 3 runs/);
  const final = read(done.file);
  assert.equal(final.runs.length, 3);
  assert.equal(final.harness.complete, true);
  assert.doesNotMatch(final.warnings.join('\n'), /did not finish/);
});

test('records an unexpected throw in a run as that run’s failure and goes on', async () => {
  const r = rig({
    runOnePage: async ({ schedule }) => {
      if (schedule.repeat === 1) throw new TypeError('cannot read properties of undefined');
      return goodRun(schedule);
    },
  });
  const done = await go(r, options());
  assert.equal(done.failed, 1);
  const file = read(done.file);
  assert.deepEqual(
    file.runs.map((run) => run.status),
    ['ok', 'failed', 'ok'],
  );
  assert.match(file.runs[1].error, /cannot read properties/);
});

test('records a page that never opens as that run’s failure, not a hang', async () => {
  const r = rig({ session: () => new Promise(() => undefined) });
  const done = await go(r, options('--repeats', '1'));
  assert.equal(done.failed, 1);
  assert.match(read(done.file).runs[0].error, /open a page: no answer in 60 ms/);
});

test('writes what it has, saying so, when a signal runs its cleanups mid-run', async () => {
  const opts = options();
  let release;
  const held = new Promise((resolve) => (release = resolve));
  let reached;
  const second = new Promise((resolve) => (reached = resolve));
  const r = rig({
    runOnePage: async ({ schedule }) => {
      if (schedule.repeat === 1) {
        reached();
        await held;
      }
      return goodRun(schedule);
    },
  });
  const running = go(r, opts);
  await second;
  await runCleanups(r.cleanups, () => undefined);
  const [name] = readdirSync(opts.out).filter((f) => f.endsWith('.json'));
  const interrupted = read(join(opts.out, name));
  assert.equal(interrupted.runs.length, 1);
  assert.equal(interrupted.harness.complete, false);
  assert.match(interrupted.warnings.join('\n'), /interrupted.*kit A r1 was under way/);
  release();
  await running;
});

test('says a remote run without a display was headless, and records it as such', async () => {
  const r = rig({ headless: true });
  const done = await go(r, options('--target', 'remote', '--ssh', 'sima@board', '--repeats', '1'));
  assert.equal(done.run.harness.headless, true);
  const text = done.run.warnings.join('\n');
  assert.match(text, /Headless run/);
  assert.match(text, /--remote-display/);
  assert.equal(r.seen.remotes[0].headless, true);
});

test('records the browser’s real mode, not the flag: --headless against a headed browser', async () => {
  const r = rig({ headless: false });
  const done = await go(r, options('--headless', '--repeats', '1'));
  assert.equal(done.run.harness.headless, false);
  assert.doesNotMatch(done.run.warnings.join('\n'), /Headless run/);
});

test('warns of a headless CDP target the harness did not start', async () => {
  const r = rig({ headless: true });
  const done = await go(r, options('--target', 'cdp:http://127.0.0.1:9222', '--repeats', '1'));
  assert.match(done.run.warnings.join('\n'), /Headless run/);
  assert.equal(done.run.harness.headless, true);
});

test('hands the board’s start the cleanup list and registers no second stop of its own', async () => {
  const r = rig();
  await go(r, options('--target', 'remote', '--ssh', 'sima@board', '--repeats', '1'));
  assert.ok(Array.isArray(r.seen.remotes[0].cleanups));
  assert.equal(r.seen.remotes.filter((entry) => entry === 'stopped').length, 0);
  await runCleanups(r.cleanups, () => undefined);
  assert.equal(r.seen.remotes.filter((entry) => entry === 'stopped').length, 1);
});

test('the result’s commit is the measured build’s, and a build from elsewhere is warned of', async () => {
  const r = rig({ runOnePage: async ({ schedule }) => goodRun(schedule, 'd'.repeat(40)) });
  const done = await go(r, options('--repeats', '1'));
  assert.equal(done.run.bench.gitSha, 'd'.repeat(40));
  assert.ok(done.run.bench.checkoutSha, 'the checkout’s is kept beside it');
  assert.match(done.run.warnings.join('\n'), /measured build is from d{12}/);
});

test('warns of a build with no stamp, and of one that --url serves that cannot be verified', async () => {
  const r = rig({ runOnePage: async ({ schedule }) => goodRun(schedule, 'unknown') });
  const done = await go(r, options('--repeats', '1'));
  assert.equal(done.run.bench.gitSha, 'unknown');
  assert.match(done.run.warnings.join('\n'), /--url.*unverified/s);
});

test('warns where the page loads came from different builds', async () => {
  const r = rig({
    runOnePage: async ({ schedule }) =>
      goodRun(schedule, schedule.repeat === 0 ? SHA : 'e'.repeat(40)),
  });
  const done = await go(r, options('--repeats', '2'));
  assert.match(done.run.warnings.join('\n'), /different commits/);
  assert.equal(done.run.bench.gitSha, 'unknown');
});

// A board-served campaign has no --url: the build to copy is a folder with an index.html.
const built = join(out, 'dist');
mkdirSync(built, { recursive: true });
writeFileSync(join(built, 'index.html'), '<!doctype html>');
const boardOptions = (...args) =>
  parseArgs([
    '--machine',
    'rig',
    '--ssh',
    'sima@board',
    '--dist',
    built,
    '--renderers',
    'kit',
    '--repeats',
    '1',
    '--cooldown',
    '0',
    '--no-screenshots',
    '--out',
    mkdtempSync(join(out, 'run-')),
    ...args,
  ]);

test('serves from the board: no server here, and the page loads from the board’s address', async () => {
  const r = rig();
  const done = await go(
    r,
    boardOptions('--target', 'remote', '--remote-display', 'bare', '--serve', 'board'),
  );
  assert.equal(r.seen.served, 0);
  assert.deepEqual(r.seen.remotes[0].serve, { bind: '127.0.0.1', dist: built });
  assert.equal(r.seen.remotes[0].serverPort, undefined, 'no reverse tunnel to a server here');
  assert.equal(r.seen.remotes[0].browser, true);
  assert.equal(done.run.harness.pageBase, 'http://10.42.0.68:40213/');
  assert.equal(done.run.harness.servedFrom, 'board 127.0.0.1');
});

test('has the board serve a browser here, and starts no browser on the board', async () => {
  const r = rig();
  const done = await go(r, boardOptions('--serve', 'board:10.42.0.68'));
  assert.equal(r.seen.remotes[0].browser, false);
  assert.equal(r.seen.opens[0].target.kind, 'local');
  assert.equal(done.run.harness.pageBase, 'http://10.42.0.68:40213/');
  await runCleanups(r.cleanups, () => undefined);
});

test('serves from this laptop, as before, where --serve is not given', async () => {
  const r = rig();
  await go(r, boardOptions('--target', 'remote'));
  assert.equal(r.seen.served, 1);
  assert.equal(r.seen.remotes[0].serve, undefined);
  assert.equal(r.seen.remotes[0].serverPort, 2);
});

test('records the bare display and reads its mode with its own cookie', async () => {
  const r = rig();
  const done = await go(r, boardOptions('--target', 'remote', '--remote-display', 'bare'));
  assert.equal(r.seen.remotes[0].headless, false);
  assert.equal(done.run.harness.display.name, ':0');
  assert.deepEqual(done.run.harness.display.mode, { w: 1920, h: 1080 });
  assert.match(
    r.seen.hosts[0],
    /DISPLAY=:0 XAUTHORITY='\/tmp\/neat-bench-[\w-]+\/Xauthority' xrandr/,
  );
  await runCleanups(r.cleanups, () => undefined);
});

test('says in the result that the display was restored, after the board’s teardown', async () => {
  const r = rig();
  r.seen.stopWith = { report: { display: { state: 'restored' } } };
  const opts = boardOptions('--target', 'remote', '--remote-display', 'bare');
  const done = await go(r, opts);
  assert.match(read(done.file).harness.display.restore, /not yet restored/);
  await runCleanups(r.cleanups, () => undefined);
  const after = read(done.file);
  assert.equal(after.harness.display.restore, 'display restored');
  assert.doesNotMatch(after.warnings.join('\n'), /display was not put back/);
});

test('says why in the result and a warning when the display was not restored', async () => {
  const r = rig();
  r.seen.stopWith = {
    report: {
      display: { state: 'not-restored', why: 'lightdm is failed (sudo systemctl start lightdm)' },
    },
  };
  const done = await go(r, boardOptions('--target', 'remote', '--remote-display', 'bare'));
  await runCleanups(r.cleanups, () => undefined);
  const after = read(done.file);
  assert.match(after.harness.display.restore, /display not restored: lightdm is failed/);
  assert.match(after.warnings.join('\n'), /display was not put back/);
});

test('judges the teardown’s word on the display', () => {
  assert.equal(displayRestore(null), null);
  assert.deepEqual(displayRestore({ report: { display: { state: 'restored' } } }), {
    ok: true,
    text: 'display restored',
  });
  assert.equal(
    displayRestore({ report: { display: { state: 'unchanged', why: 'lightdm was inactive' } } }).ok,
    true,
  );
  // No word on the display: the run never recorded LightDM, so it never stopped it.
  assert.deepEqual(displayRestore({ report: {} }), {
    ok: true,
    text: 'display untouched: the run ended before LightDM was stopped',
  });
  const failed = displayRestore({ error: new Error('ssh: no answer'), guard: 999 });
  assert.equal(failed.ok, false);
  assert.match(failed.text, /display not confirmed: ssh: no answer; .*guard \(pid 999\) restores/);
});

test('says complete: false when the user stopped it, even where the run under way ended', async () => {
  const controller = new AbortController();
  const r = rig({
    runOnePage: async ({ schedule }) => {
      controller.abort('SIGINT');
      return goodRun(schedule);
    },
  });
  const done = await runCampaign(boardOptions('--target', 'remote', '--repeats', '3'), {
    log: (line) => r.logs.push(line),
    cleanups: r.cleanups,
    deps: r.deps,
    signal: controller.signal,
  });
  const result = read(done.file);
  assert.equal(result.harness.complete, false);
  assert.equal(result.runs.length, 1, 'no run starts after the stop');
  assert.match(result.warnings.join('\n'), /did not finish \(interrupted by SIGINT\)/);
  await runCleanups(r.cleanups, () => undefined);
});

test('tells the caller the board’s guard once it is up', async () => {
  const r = rig();
  const board = { guard: null };
  const start = r.deps.startRemote;
  r.deps.startRemote = async (args) => {
    args.onGuard(4242);
    return start(args);
  };
  await runCampaign(boardOptions('--target', 'remote', '--remote-display', 'bare'), {
    log: () => undefined,
    cleanups: r.cleanups,
    deps: r.deps,
    board,
  });
  assert.equal(board.guard, 4242);
  await runCleanups(r.cleanups, () => undefined);
});

test('records the extra browser flags in the machine and hands them to both browsers', async () => {
  const r = rig({ headless: false });
  const flags = '--disable-gpu --num-raster-threads=4';
  const done = await go(r, options('--browser-flags', flags, '--repeats', '1'));
  assert.deepEqual(done.run.machine.browserFlags, ['--disable-gpu', '--num-raster-threads=4']);
  assert.deepEqual(r.seen.opens[0].browserFlags, ['--disable-gpu', '--num-raster-threads=4']);

  const remote = rig({ headless: false });
  await go(
    remote,
    options('--browser-flags', '--disable-gpu', '--target', 'remote', '--ssh', 'sima@board'),
  );
  assert.deepEqual(remote.seen.remotes[0].browserFlags, ['--disable-gpu']);

  const plain = await go(rig(), options('--repeats', '1'));
  assert.deepEqual(plain.run.machine.browserFlags, []);
});

test('records the trace categories in the harness info', async () => {
  const plain = await go(rig(), options('--repeats', '1'));
  assert.deepEqual(plain.run.harness.traceCategories, ['viz']);
  const wide = await go(
    rig(),
    options('--repeats', '1', '--trace', '--trace-categories', 'viz,cc'),
  );
  assert.deepEqual(wide.run.harness.traceCategories, ['viz', 'cc']);
});
