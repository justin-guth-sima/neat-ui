import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { spawnSsh, sshArgs, sshRun } from './ssh.mjs';

/** A spawn that records its call and answers like an ssh that ran the script. */
function fakeSpawn(code = 0) {
  const seen = {};
  const spawn = (command, args, options) => {
    Object.assign(seen, { command, args, options });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: (input) => (seen.input = input) };
    child.kill = () => undefined;
    setImmediate(() => {
      child.stdout.emit('data', 'out\n');
      child.emit('close', code);
    });
    return child;
  };
  return { seen, spawn };
}

test('runs every ssh out of the terminal’s process group, so a Ctrl-C reaches node only', async () => {
  const f = fakeSpawn();
  const result = await sshRun('sima@board', 'echo hi\n', { spawn: f.spawn });
  assert.deepEqual(result, { code: 0, stdout: 'out\n', stderr: '' });
  assert.equal(f.seen.command, 'ssh');
  assert.equal(f.seen.options.detached, true);
  assert.deepEqual(f.seen.options.stdio, ['pipe', 'pipe', 'pipe']);
  assert.deepEqual(f.seen.args.slice(-3), ['--', 'sima@board', 'sh -s']);
  assert.equal(f.seen.input, 'echo hi\n');
  const g = fakeSpawn();
  spawnSsh('sima@board', { extra: ['-N'], stdio: 'ignore', spawn: g.spawn });
  assert.equal(g.seen.options.detached, true);
  assert.deepEqual(g.seen.args, sshArgs('sima@board', ['-N']));
});

test('resolves with ssh’s own failure as code 255, for the caller to judge', async () => {
  const f = fakeSpawn(255);
  assert.equal((await sshRun('sima@board', 'x', { spawn: f.spawn })).code, 255);
});
