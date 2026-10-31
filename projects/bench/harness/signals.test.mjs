import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interruptHandler } from './signals.mjs';

function rig(guarded = true) {
  const seen = { lines: [], teardowns: 0, exits: [], aborted: [] };
  let finish;
  const done = new Promise((resolve) => (finish = resolve));
  const handle = interruptHandler({
    log: (line) => seen.lines.push(line),
    teardown: () => {
      seen.teardowns += 1;
      return done;
    },
    exit: (code) => seen.exits.push(code),
    guarded: () => guarded,
    abort: (signal) => seen.aborted.push(signal),
  });
  return { seen, handle, finish };
}

test('starts the teardown once under repeated Ctrl-C, says what goes on, and quits on the third', async () => {
  const r = rig();
  r.handle('SIGINT');
  r.handle('SIGINT');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(r.seen.teardowns, 1);
  assert.deepEqual(r.seen.exits, [], 'the second does not quit');
  assert.deepEqual(r.seen.aborted, ['SIGINT']);
  assert.equal(r.seen.lines[1], 'teardown in progress; the board restores itself if you quit');
  r.handle('SIGINT');
  assert.deepEqual(r.seen.exits, [130]);
  assert.equal(r.seen.teardowns, 1);
});

test('exits 130 once the teardown has ended', async () => {
  const r = rig();
  r.handle('SIGTERM');
  r.finish();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(r.seen.exits, [130]);
  assert.match(r.seen.lines[0], /^SIGTERM: stopping what was started$/);
});

test('says that quitting leaves things where no guard on the board finishes the teardown', () => {
  const r = rig(false);
  r.handle('SIGHUP');
  r.handle('SIGINT');
  assert.match(r.seen.lines[1], /quitting now leaves on the board what it has not stopped yet/);
});
