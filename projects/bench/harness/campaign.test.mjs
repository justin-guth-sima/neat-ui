import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { parseArgs } from './args.mjs';
import { runCampaign } from './campaign.mjs';
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
  const seen = { opens: [], remotes: [] };
  const deps = {
    openBrowser: async (args) => {
      seen.opens.push(args);
      return opened;
    },
    startRemote: async (args) => {
      seen.remotes.push(args);
      args.cleanups.push(async () => seen.remotes.push('stopped'));
      return {
        endpoint: 'http://127.0.0.1:55555',
        pageBase: 'http://127.0.0.1:4390/',
        stop: async () => undefined,
      };
    },
    serveDist: async () => ({ url: 'http://127.0.0.1:2/', port: 2, close: async () => undefined }),
    runOnePage: runOnePage ?? (async ({ schedule }) => goodRun(schedule)),
    sshRun: async () => ({ code: 0, stdout: '', stderr: '' }),
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
