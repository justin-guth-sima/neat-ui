import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runCleanups } from './cleanup.mjs';

test('undoes what was started last first, and empties the list', async () => {
  const order = [];
  const cleanups = [
    async () => order.push('server'),
    async () => order.push('board'),
    () => order.push('browser'),
  ];
  const failed = await runCleanups(cleanups, () => undefined);
  assert.deepEqual(order, ['browser', 'board', 'server']);
  assert.equal(failed, 0);
  assert.equal(cleanups.length, 0);
});

test('goes on after one that fails, says so, and counts it for the exit code', async () => {
  const order = [];
  const lines = [];
  const failed = await runCleanups(
    [
      () => order.push('server'),
      async () => {
        throw new Error('the board was not cleaned up');
      },
      () => order.push('browser'),
    ],
    (line) => lines.push(line),
  );
  assert.deepEqual(order, ['browser', 'server']);
  assert.equal(failed, 1);
  assert.match(lines.join('\n'), /cleanup failed: the board was not cleaned up/);
});
